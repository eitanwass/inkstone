import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discordRequest, FeedbackGate, handleFeedback, parseFeedback } from '../../../party/feedback.js';

const good = {
  message: 'The wall tool is great',
  email: '',
  version: '0.12.0',
  screen: '1280x720',
  page: 'editor',
};

describe('parseFeedback', () => {
  it('reads a message, with what comes with it', () => {
    expect(parseFeedback({ ...good, email: 'dm@example.com' })).toEqual({
      feedback: { ...good, email: 'dm@example.com', map: null },
    });
  });

  it('needs a message, and trims it and cuts it to 2,000 characters', () => {
    expect(parseFeedback({ ...good, message: '   ' })).toEqual({ error: 'empty' });
    expect(parseFeedback({ message: 42 })).toEqual({ error: 'empty' });
    expect(parseFeedback({ ...good, message: `  hi  ` }).feedback?.message).toBe('hi');
    expect(parseFeedback({ ...good, message: 'x'.repeat(5000) }).feedback?.message).toHaveLength(2000);
  });

  it('takes an email only if it is one, and none is fine', () => {
    expect(parseFeedback({ ...good, email: 'not an email' })).toEqual({ error: 'email' });
    expect(parseFeedback({ ...good, email: '' }).feedback?.email).toBe('');
    expect(parseFeedback({ ...good, email: undefined }).feedback?.email).toBe('');
  });

  it('takes an attached map only as text of at most 2,000,000 characters', () => {
    expect(parseFeedback({ ...good, map: '{"a":1}' }).feedback?.map).toBe('{"a":1}');
    expect(parseFeedback({ ...good, map: { a: 1 } })).toEqual({ error: 'map' });
    expect(parseFeedback({ ...good, map: 'x'.repeat(2_000_001) })).toEqual({ error: 'map' });
  });

  it('says it came from the site only for exactly "contact", and cuts the rest short', () => {
    expect(parseFeedback({ ...good, page: 'contact' }).feedback?.page).toBe('contact');
    expect(parseFeedback({ ...good, page: 'anything' }).feedback?.page).toBe('editor');
    expect(parseFeedback({ ...good, version: 'v'.repeat(99) }).feedback?.version).toHaveLength(20);
  });

  it('is spam when the hidden field is filled in, and anything that is not an object is bad', () => {
    expect(parseFeedback({ ...good, website: 'http://spam.example' })).toEqual({ spam: true });
    expect(parseFeedback({ ...good, website: '' }).feedback).toBeDefined();
    expect(parseFeedback(null)).toEqual({ error: 'bad' });
    expect(parseFeedback('hi')).toEqual({ error: 'bad' });
  });
});

describe('discordRequest', () => {
  const feedback = { ...good, email: 'dm@example.com', map: null, page: 'editor' };
  const payload = (init: RequestInit) => JSON.parse((init.body as FormData).get('payload_json') as string);

  it('is an embed with the message and what came with it, and no pings', () => {
    const { url, init } = discordRequest(
      feedback,
      'https://discord.test/hook',
      new Date('2026-10-07T12:00:00Z'),
    );
    expect(url).toBe('https://discord.test/hook');
    expect(init.method).toBe('POST');
    const sent = payload(init);
    expect(sent.allowed_mentions).toEqual({ parse: [] });
    expect(sent.embeds[0]).toMatchObject({
      title: 'Feedback from the editor',
      description: 'The wall tool is great',
      timestamp: '2026-10-07T12:00:00.000Z',
    });
    expect(sent.embeds[0].fields).toEqual([
      { name: 'Email', value: 'dm@example.com', inline: true },
      { name: 'Version', value: '0.12.0', inline: true },
      { name: 'Screen', value: '1280x720', inline: true },
    ]);
    expect((init.body as FormData).get('files[0]')).toBeNull();
  });

  it('says so when there is no email, and where it came from', () => {
    const sent = payload(discordRequest({ ...feedback, email: '', page: 'contact' }, 'u').init);
    expect(sent.embeds[0].title).toBe('Feedback from the site');
    expect(sent.embeds[0].fields[0].value).toBe('not given');
  });

  it('attaches the map as a file', async () => {
    const { init } = discordRequest({ ...feedback, map: '{"format":"inkstone"}' }, 'u');
    const file = (init.body as FormData).get('files[0]') as File;
    expect(file.name).toBe('map.inkstone.json');
    expect(await file.text()).toBe('{"format":"inkstone"}');
  });
});

// A stand-in for the gate: lets everything in, or says busy.
const gate = (status = 200) => ({
  idFromName: () => 'id',
  get: () => ({ fetch: vi.fn(async () => new Response('x', { status })) }),
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://relay.test/feedback', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('handleFeedback', () => {
  const discord = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
  const env = (over: Record<string, unknown> = {}) => ({
    FEEDBACK_WEBHOOK: 'https://discord.test/hook',
    FEEDBACK_GATE: gate(),
    ...over,
  });
  beforeEach(() => discord.mockClear());

  it('posts what was sent to Discord and says it went', async () => {
    const response = await handleFeedback(post(good), env(), discord);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(discord).toHaveBeenCalledTimes(1);
    expect(discord.mock.calls[0][0]).toBe('https://discord.test/hook');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it("answers the browser's question before a cross-site post, and refuses other methods", async () => {
    const preflight = await handleFeedback(
      new Request('https://relay.test/feedback', { method: 'OPTIONS' }),
      env(),
      discord,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    const get = await handleFeedback(new Request('https://relay.test/feedback'), env(), discord);
    expect(get.status).toBe(405);
    expect(discord).not.toHaveBeenCalled();
  });

  it('says feedback is not set up when there is no webhook, and posts nothing', async () => {
    const response = await handleFeedback(post(good), env({ FEEDBACK_WEBHOOK: undefined }), discord);
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ error: 'not-set-up' });
    expect(discord).not.toHaveBeenCalled();
  });

  it('refuses what is not JSON, has no message, or is far too big', async () => {
    expect((await handleFeedback(post('not json'), env(), discord)).status).toBe(400);
    const empty = await handleFeedback(post({ ...good, message: '' }), env(), discord);
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'empty' });
    const big = await handleFeedback(post({ ...good, map: 'x'.repeat(2_400_000) }), env(), discord);
    expect(big.status).toBe(413);
    expect(discord).not.toHaveBeenCalled();
  });

  it('pretends a spam form went, and sends it nowhere', async () => {
    const response = await handleFeedback(post({ ...good, website: 'spam' }), env(), discord);
    expect(response.status).toBe(200);
    expect(discord).not.toHaveBeenCalled();
  });

  it('says busy, and posts nothing, when the gate has had enough from this visitor', async () => {
    const response = await handleFeedback(post(good), env({ FEEDBACK_GATE: gate(429) }), discord);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'busy' });
    expect(discord).not.toHaveBeenCalled();
  });

  it('gives the gate a hash of the visitor, never their address', async () => {
    const fetchGate = vi.fn(async (_url: string) => new Response('ok'));
    const gateWithSpy = { idFromName: () => 'id', get: () => ({ fetch: fetchGate }) };
    await handleFeedback(post(good), env({ FEEDBACK_GATE: gateWithSpy }), discord);
    const asked = String(fetchGate.mock.calls[0][0]);
    expect(asked).toMatch(/^https:\/\/gate\/\?key=[0-9a-f]{16}$/);
    expect(asked).not.toContain('203.0.113.7');
  });

  it('says it failed, and not that it went, when Discord does not take it', async () => {
    const refusing = vi.fn(async () => new Response('', { status: 500 }));
    expect((await handleFeedback(post(good), env(), refusing)).status).toBe(502);
    const throwing = vi.fn(async () => {
      throw new Error('network');
    });
    expect((await handleFeedback(post(good), env(), throwing)).status).toBe(502);
  });
});

describe('FeedbackGate', () => {
  function fakeState() {
    const data = new Map<string, unknown>();
    return {
      data,
      alarm: null as number | null,
      storage: {
        get: async (key: string) => data.get(key),
        put: async (entries: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(entries)) data.set(k, v);
        },
        setAlarm: async (t: number) => {
          state.alarm = t;
        },
        deleteAll: async () => data.clear(),
      },
    };
  }
  let state: ReturnType<typeof fakeState>;
  const ask = (gate: FeedbackGate, key: string) => gate.fetch(new Request(`https://gate/?key=${key}`));

  beforeEach(() => {
    vi.useFakeTimers();
    state = fakeState();
  });
  afterEach(() => vi.useRealTimers());

  it('lets a visitor send five an hour, and the sixth is busy; others are not affected', async () => {
    const gate = new FeedbackGate(state);
    for (let i = 0; i < 5; i++) expect((await ask(gate, 'aa')).status).toBe(200);
    expect((await ask(gate, 'aa')).status).toBe(429);
    expect((await ask(gate, 'bb')).status).toBe(200);
  });

  it('lets them send again an hour later', async () => {
    const gate = new FeedbackGate(state);
    for (let i = 0; i < 5; i++) await ask(gate, 'aa');
    await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    expect((await ask(gate, 'aa')).status).toBe(200);
  });

  it('lets everyone together send 300 a day, and no more', async () => {
    const gate = new FeedbackGate(state);
    for (let i = 0; i < 300; i++) expect((await ask(gate, `v${i}`)).status).toBe(200);
    expect((await ask(gate, 'one-more')).status).toBe(429);
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
    expect((await ask(gate, 'one-more')).status).toBe(200);
  });

  it('forgets everything after a day with nothing sent', async () => {
    const gate = new FeedbackGate(state);
    await ask(gate, 'aa');
    expect(state.alarm).toBeGreaterThan(Date.now());
    await gate.alarm();
    expect(state.data.size).toBe(0);
  });
});
