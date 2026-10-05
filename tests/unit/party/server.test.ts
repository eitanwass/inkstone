import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InkstoneRoom, parseMessage } from '../../../party/server.js';

// The relay's storage is faked with a Map; Cloudflare's own behaviour (blockConcurrencyWhile holding
// back requests until the load is done) is relied on, not tested.
function fakeState(data = new Map<string, unknown>()) {
  const state = {
    data,
    alarm: null as number | null,
    writes: 0, // calls to put, to see that an edit writes only what changed
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    storage: {
      list: async () => new Map(data),
      put: async (entries: Record<string, unknown>) => {
        state.writes++;
        for (const [k, v] of Object.entries(entries)) data.set(k, v);
      },
      delete: async (keys: string[]) => {
        for (const k of keys) data.delete(k);
      },
      setAlarm: async (t: number) => {
        state.alarm = t;
      },
      deleteAll: async () => data.clear(),
    },
  };
  return state;
}
let state: ReturnType<typeof fakeState>;

type Room = InstanceType<typeof InkstoneRoom>;

function fakeSocket() {
  const listeners: Record<string, (e: { data: string }) => void> = {};
  const sent: string[] = [];
  return {
    sent,
    accept() {},
    send: (m: string) => void sent.push(m),
    addEventListener: (type: string, fn: (e: { data: string }) => void) => {
      listeners[type] = fn;
    },
    emit: (type: string, data = '') => listeners[type]({ data }),
    // What the room last told this client, parsed.
    // biome-ignore lint/suspicious/noExplicitAny: a test reading whatever the room said
    last: (): any => JSON.parse(sent[sent.length - 1]),
    say: (message: unknown) => listeners.message({ data: JSON.stringify(message) }),
  };
}

const rect = (id: string, x = 0) => ({ type: 'rect', id, x, y: 0, w: 40, h: 40 });
const set = (el: unknown) => ({ t: 'set', el });
const del = (id: string) => ({ t: 'del', id });
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function openRoom(s = state) {
  const room = new InkstoneRoom(s);
  await room.ready;
  return room;
}

// A client that has connected and said hello; what it hears back is in `last()`.
function join(
  room: Room,
  { cid = 'c1', since, epoch }: { cid?: string; since?: number; epoch?: string } = {},
) {
  const ws = fakeSocket();
  room.handleSession(ws);
  ws.say({ type: 'hello', cid, author: { id: `a-${cid}`, name: `Guest ${cid}` }, since, epoch });
  return ws;
}

// A room with this map, given by a first client (cid "seed") and saved.
async function seeded(elements: unknown[], name = '') {
  const room = await openRoom();
  const first = join(room, { cid: 'seed' });
  first.say({ type: 'doc', name, elements });
  await vi.advanceTimersByTimeAsync(2500);
  return { room, first, epoch: first.last().epoch as string };
}

// The map as a joiner is told it.
let lookers = 0;
const mapOf = (room: Room) => join(room, { cid: `look${lookers++}` }).last();

beforeEach(() => {
  vi.useFakeTimers();
  state = fakeState();
});
afterEach(() => vi.useRealTimers());

describe('parseMessage', () => {
  const hello = { type: 'hello', cid: 'c1', author: { id: 'a1', name: 'Guest 1' } };

  it('accepts hello, doc, and changes', () => {
    expect(parseMessage(JSON.stringify(hello))).toMatchObject({ type: 'hello', cid: 'c1' });
    expect(parseMessage(JSON.stringify({ ...hello, epoch: 'e1', since: 4 }))).toMatchObject({
      epoch: 'e1',
      since: 4,
    });
    expect(parseMessage(JSON.stringify({ type: 'doc', name: 'N', elements: [rect('a')] }))).toMatchObject({
      type: 'doc',
    });
    const changes = [set(rect('a')), del('b'), { t: 'order', ids: ['a'] }, { t: 'name', name: 'N' }];
    expect(parseMessage(JSON.stringify({ type: 'changes', base: 3, changes }))).toMatchObject({
      type: 'changes',
      base: 3,
    });
  });

  it('refuses anything else, whole', () => {
    const changes = (list: unknown[], base: unknown = 0) =>
      JSON.stringify({ type: 'changes', base, changes: list });
    const doc = (elements: unknown[], name = '') => JSON.stringify({ type: 'doc', name, elements });
    const bad = [
      '',
      'nope',
      '[]',
      '{}',
      'null',
      42,
      null,
      '{"type":"snapshot","elements":[]}',
      JSON.stringify({ ...hello, cid: 'no spaces' }),
      JSON.stringify({ ...hello, author: { id: 'a1', name: 'x'.repeat(41) } }),
      JSON.stringify({ ...hello, author: 'me' }),
      JSON.stringify({ ...hello, since: -1 }),
      JSON.stringify({ ...hello, since: 1.5 }),
      JSON.stringify({ ...hello, epoch: 42 }),
      doc([{ type: 'rect', x: 0 }]), // no id
      doc([{ type: 'hologram', id: 'a' }]),
      doc([rect('no spaces')]),
      doc([rect('a')], 'x'.repeat(201)),
      doc([{ ...rect('a'), pad: 'x'.repeat(20_000) }]),
      JSON.stringify({ type: 'changes', changes: [del('a')] }), // no base
      changes([del('a')], -1),
      changes([del('a'), { t: 'explode' }]), // one bad change spoils the message
      changes([{ t: 'order', ids: [1] }]),
      changes([{ t: 'del', id: 42 }]),
      `{"type":"changes","base":0,"changes":[],"pad":"${'x'.repeat(900_000)}"}`,
    ];
    for (const message of bad) expect(parseMessage(message), String(message).slice(0, 60)).toBeNull();
  });
});

describe('meeting the room', () => {
  it('says nothing until a client says hello, and takes nothing from one that has not', async () => {
    const room = await openRoom();
    const ws = fakeSocket();
    room.handleSession(ws);
    ws.say({ type: 'doc', name: '', elements: [rect('a')] });
    ws.say({ type: 'changes', base: 0, changes: [set(rect('b'))] });
    expect(ws.sent).toEqual([]);
    expect(mapOf(room).elements).toEqual([]);
  });

  it('is fresh until someone gives it a map, and the first one to do so gets to', async () => {
    const room = await openRoom();
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    expect(a.last()).toMatchObject({ type: 'doc', fresh: true, rev: 0, name: '', elements: [] });
    expect(b.last().fresh).toBe(true);

    a.say({ type: 'doc', name: 'Mine', elements: [rect('a')] });
    expect(a.last()).toMatchObject({ type: 'ack', rev: 0, fix: [] });
    b.say({ type: 'doc', name: 'Theirs', elements: [rect('b')] }); // too late
    expect(b.last()).toMatchObject({ type: 'doc', fresh: false, name: 'Mine', elements: [rect('a')] });
  });

  it('gives every life of the room its own epoch', async () => {
    const one = (await seeded([rect('a')])).epoch;
    state = fakeState();
    const two = (await seeded([rect('a')])).epoch;
    expect(one).toMatch(/^[0-9a-f]{16}$/);
    expect(two).not.toBe(one);
  });
});

describe('changes', () => {
  it('become the next revision: passed on with it, and acknowledged to the sender', async () => {
    const { room, first } = await seeded([rect('a'), rect('b')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say({ type: 'changes', base: 0, changes: [set(rect('b', 80)), set(rect('c')), del('a')] });
    expect(a.last()).toMatchObject({ type: 'ack', rev: 1, fix: [] });
    expect(b.last()).toEqual({
      type: 'changes',
      rev: 1,
      changes: [set(rect('b', 80)), set(rect('c')), del('a')],
    });
    expect(first.last()).toMatchObject({ type: 'changes', rev: 1 });
    expect(mapOf(room)).toMatchObject({ rev: 1, elements: [rect('b', 80), rect('c')] });
  });

  it("keeps two people's edits to different elements", async () => {
    const { room } = await seeded([rect('a'), rect('b')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 40))] });
    b.say({ type: 'changes', base: 0, changes: [set(rect('b', 80))] }); // built on 0, but touches something else
    expect(b.last()).toMatchObject({ type: 'ack', rev: 2, fix: [] });
    expect(mapOf(room).elements).toEqual([rect('a', 40), rect('b', 80)]);
  });

  it('reorders, and renames without touching the map', async () => {
    const { room } = await seeded([rect('a'), rect('b'), rect('c')], 'Old');
    const a = join(room, { cid: 'a' });
    a.say({ type: 'changes', base: 0, changes: [{ t: 'order', ids: ['c', 'a', 'b'] }] });
    a.say({ type: 'changes', base: 1, changes: [{ t: 'name', name: 'New' }] });
    expect(mapOf(room)).toMatchObject({ name: 'New', elements: [rect('c'), rect('a'), rect('b')] });
  });

  it('drops a bad message: not applied, not passed on, not acknowledged, not kept', async () => {
    const { room } = await seeded([rect('a')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    const [heardA, heardB] = [a.sent.length, b.sent.length];
    a.say({ type: 'changes', base: 0, changes: [set({ type: 'rect' })] });
    await vi.advanceTimersByTimeAsync(5000);
    expect([a.sent.length, b.sent.length]).toEqual([heardA, heardB]);
    expect(mapOf(room)).toMatchObject({ rev: 0, elements: [rect('a')] });
  });
});

describe('when two people change the same thing, the room wins', () => {
  it('refuses an edit to an element someone else changed after the revision it was built on', async () => {
    const { room } = await seeded([rect('a'), rect('b')]);
    const [a, b, c] = [join(room, { cid: 'a' }), join(room, { cid: 'b' }), join(room, { cid: 'c' })];
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 40))] }); // revision 1
    const heardByC = c.sent.length;
    b.say({ type: 'changes', base: 0, changes: [set(rect('a', 99)), set(rect('b', 80))] });

    // b's edit to b went in (revision 2), its edit to a did not, and b is sent the room's a
    expect(b.last()).toEqual({ type: 'ack', epoch: expect.any(String), rev: 2, fix: [set(rect('a', 40))] });
    expect(JSON.parse(c.sent[heardByC])).toEqual({ type: 'changes', rev: 2, changes: [set(rect('b', 80))] });
    expect(mapOf(room).elements).toEqual([rect('a', 40), rect('b', 80)]);
  });

  it('does not make a revision, or tell the others, when everything was refused', async () => {
    const { room } = await seeded([rect('a')]);
    const [a, b, c] = [join(room, { cid: 'a' }), join(room, { cid: 'b' }), join(room, { cid: 'c' })];
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 40))] });
    const heardByC = c.sent.length;
    b.say({ type: 'changes', base: 0, changes: [set(rect('a', 99))] });
    expect(b.last()).toMatchObject({ type: 'ack', rev: 1, fix: [set(rect('a', 40))] });
    expect(c.sent.length).toBe(heardByC);
    expect(mapOf(room).rev).toBe(1);
  });

  it('refuses an edit to an element someone deleted, and tells the sender it is gone', async () => {
    const { room } = await seeded([rect('a'), rect('b')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say({ type: 'changes', base: 0, changes: [del('a')] });
    b.say({ type: 'changes', base: 0, changes: [set(rect('a', 5))] });
    expect(b.last().fix).toEqual([del('a')]);
    expect(mapOf(room).elements).toEqual([rect('b')]);
  });

  it('refuses a deletion of an element someone edited, and sends the sender their version', async () => {
    const { room } = await seeded([rect('a')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 7))] });
    b.say({ type: 'changes', base: 0, changes: [del('a')] });
    expect(b.last().fix).toEqual([set(rect('a', 7))]);
    expect(mapOf(room).elements).toEqual([rect('a', 7)]);
  });

  it('refuses a reorder after someone else reordered, and a rename after someone else renamed', async () => {
    const { room } = await seeded([rect('a'), rect('b')], 'Old');
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say({
      type: 'changes',
      base: 0,
      changes: [
        { t: 'order', ids: ['b', 'a'] },
        { t: 'name', name: 'Mine' },
      ],
    });
    b.say({
      type: 'changes',
      base: 0,
      changes: [
        { t: 'order', ids: ['a', 'b'] },
        { t: 'name', name: 'Theirs' },
      ],
    });
    expect(b.last().fix).toEqual([
      { t: 'order', ids: ['b', 'a'] },
      { t: 'name', name: 'Mine' },
    ]);
    expect(mapOf(room)).toMatchObject({ name: 'Mine', elements: [rect('b'), rect('a')] });
  });

  it("does not count a client's own earlier batches, which it has not necessarily heard about", async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 1))] });
    a.say({ type: 'changes', base: 0, changes: [set(rect('a', 2))] }); // built before the ack arrived
    expect(a.last()).toMatchObject({ rev: 2, fix: [] });
    expect(mapOf(room).elements).toEqual([rect('a', 2)]);
  });

  it('refuses everything from a client built on a revision the log no longer reaches back to', async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    for (let i = 1; i <= 105; i++) a.say({ type: 'changes', base: i - 1, changes: [set(rect('a', i))] });
    const b = join(room, { cid: 'b' });
    b.say({ type: 'changes', base: 2, changes: [set(rect('a', -1))] });
    expect(b.last().fix).toEqual([set(rect('a', 105))]);
  });

  it('refuses a set that does not fit, and tells the sender it is not there', async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    const many = Array.from({ length: 2100 }, (_, i) => set(rect(`e${i}`)));
    a.say({ type: 'changes', base: 0, changes: many });
    expect(mapOf(room).elements).toHaveLength(2000);
    expect(a.last().fix).toHaveLength(101);
    expect(a.last().fix[0]).toEqual(del('e1999'));
  });
});

describe('catching a client up', () => {
  // Revision 1: a edited; 2: c added; 3: b deleted, order and name changed.
  async function history() {
    const { room, epoch } = await seeded([rect('a'), rect('b')], 'Crypt');
    const w = join(room, { cid: 'w' });
    w.say({ type: 'changes', base: 0, changes: [set(rect('a', 40))] });
    w.say({ type: 'changes', base: 1, changes: [set(rect('c'))] });
    w.say({
      type: 'changes',
      base: 2,
      changes: [del('b'), { t: 'order', ids: ['c', 'a'] }, { t: 'name', name: 'New' }],
    });
    return { room, epoch };
  }

  it("sends the room's current version of whatever was touched since, and nothing else", async () => {
    const { room, epoch } = await history();
    const late = join(room, { cid: 'late', since: 1, epoch });
    expect(late.last()).toEqual({
      type: 'catchup',
      epoch,
      rev: 3,
      changes: [set(rect('c')), del('b'), { t: 'order', ids: ['c', 'a'] }, { t: 'name', name: 'New' }],
    });
  });

  it('is told only what was touched: a client at revision 2 is not sent a', async () => {
    const { room, epoch } = await history();
    const late = join(room, { cid: 'late', since: 2, epoch });
    expect(late.last().changes).toEqual([
      del('b'),
      { t: 'order', ids: ['c', 'a'] },
      { t: 'name', name: 'New' },
    ]);
  });

  it('sends an empty catch-up to a client that is already up to date', async () => {
    const { room, epoch } = await history();
    expect(join(room, { cid: 'late', since: 3, epoch }).last()).toMatchObject({
      type: 'catchup',
      rev: 3,
      changes: [],
    });
  });

  it('sends the whole map when it cannot catch the client up', async () => {
    const { room, epoch } = await history();
    const whole = { type: 'doc', fresh: false, rev: 3, name: 'New', elements: [rect('c'), rect('a', 40)] };
    expect(join(room, { cid: 'x' }).last()).toMatchObject(whole); // never here before
    expect(join(room, { cid: 'x', since: 1, epoch: 'otherepoch' }).last()).toMatchObject(whole); // a different life of the room
    expect(join(room, { cid: 'x', since: 99, epoch }).last()).toMatchObject(whole); // ahead of the room
  });

  it('sends the whole map to a client further behind than the log goes', async () => {
    const { room, epoch } = await seeded([rect('a')]);
    const w = join(room, { cid: 'w' });
    for (let i = 1; i <= 105; i++) w.say({ type: 'changes', base: i - 1, changes: [set(rect('a', i))] });
    expect(join(room, { cid: 'x', since: 4, epoch }).last().type).toBe('doc'); // the log starts at 6
    expect(join(room, { cid: 'x', since: 5, epoch }).last().type).toBe('catchup');
  });
});

describe('token pictures', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  const WEBP = 'data:image/webp;base64,UklGRg==';
  const image = (id: string, data = PNG) => ({ type: 'image', id, data });

  it('keeps a picture once, and sends it to a client that asks, and only that client', async () => {
    const { room } = await seeded([rect('a')]);
    const [a, b, c] = [join(room, { cid: 'a' }), join(room, { cid: 'b' }), join(room, { cid: 'c' })];
    a.say(image('pic1'));
    const [heardB, heardC] = [b.sent.length, c.sent.length];
    b.say({ type: 'getimages', ids: ['pic1', 'nope'] });
    expect(b.last()).toEqual({ type: 'image', id: 'pic1', data: PNG });
    expect(b.sent.length).toBe(heardB + 1); // nothing for the one it hasn't got
    expect(c.sent.length).toBe(heardC); // not pushed to others, and not a revision
    expect(mapOf(room).rev).toBe(0);
  });

  it('keeps the first picture for an id, which never needs to change', async () => {
    const { room } = await seeded([rect('a')]);
    const [a, b] = [join(room, { cid: 'a' }), join(room, { cid: 'b' })];
    a.say(image('pic1'));
    a.say(image('pic1', WEBP));
    b.say({ type: 'getimages', ids: ['pic1'] });
    expect(b.last().data).toBe(PNG);
  });

  it('refuses a picture that is not a small raster data URL, or has a bad id', async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    a.say(image('svg', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
    a.say(image('big', `data:image/png;base64,${'A'.repeat(100_000)}`));
    a.say(image('no spaces'));
    a.say({ type: 'getimages', ids: ['svg', 'big'] });
    expect(a.last().type).not.toBe('image');
  });

  it('refuses a request for too many at once', () => {
    const many = Array.from({ length: 51 }, (_, i) => `p${i}`);
    expect(parseMessage(JSON.stringify({ type: 'getimages', ids: many }))).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 'getimages', ids: many.slice(1) }))).not.toBeNull();
  });

  it('stops keeping pictures past its limit', async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    for (let i = 0; i < 105; i++) a.say(image(`p${i}`));
    a.say({ type: 'getimages', ids: ['p99', 'p100'] });
    expect(a.sent.slice(-1).map((m) => JSON.parse(m).id)).toEqual(['p99']);
  });

  it('takes nothing from a client that has not said hello', async () => {
    const { room } = await seeded([rect('a')]);
    const ws = fakeSocket();
    room.handleSession(ws);
    ws.say(image('pic1'));
    const b = join(room, { cid: 'b' });
    b.say({ type: 'getimages', ids: ['pic1'] });
    expect(b.last().type).not.toBe('image');
  });

  it('is saved with the room, survives a restart, and goes when the room does', async () => {
    const { room } = await seeded([rect('a')]);
    join(room, { cid: 'a' }).say(image('pic1'));
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.data.get('img:pic1')).toBe(PNG);

    const b = join(await openRoom(), { cid: 'b' });
    b.say({ type: 'getimages', ids: ['pic1'] });
    expect(b.last()).toEqual({ type: 'image', id: 'pic1', data: PNG });

    await room.alarm();
    expect(state.data.size).toBe(0);
    const c = join(room, { cid: 'c' });
    c.say({ type: 'getimages', ids: ['pic1'] });
    expect(c.last().type).toBe('doc'); // nothing to send
  });
});

describe('saving', () => {
  it('writes once per burst of edits, and only the rows that changed, plus the new log entry', async () => {
    const { room } = await seeded([rect('a'), rect('b'), rect('c')], 'Crypt');
    expect(state.data.get('el:a')).toBe(JSON.stringify(rect('a')));
    expect(state.data.get('order')).toEqual(['a', 'b', 'c']);
    expect(state.data.get('meta')).toMatchObject({ name: 'Crypt', rev: 0 });

    const writesBefore = state.writes;
    state.data.set('el:c', 'UNTOUCHED'); // a row that must not be rewritten by an edit to a
    const a = join(room, { cid: 'a' });
    for (let i = 1; i <= 5; i++) a.say({ type: 'changes', base: i - 1, changes: [set(rect('a', i))] });
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.writes).toBe(writesBefore + 1);
    expect(state.data.get('el:a')).toBe(JSON.stringify(rect('a', 5)));
    expect(state.data.get('el:c')).toBe('UNTOUCHED');
    expect(state.data.get('meta')).toMatchObject({ rev: 5 });
    expect(state.data.get('log:5')).toMatchObject({
      rev: 5,
      cid: 'a',
      by: { id: 'a-a', name: 'Guest a' },
      ids: ['a'],
      order: false,
      name: false,
    });
  });

  it('keeps the last 100 log entries in storage', async () => {
    const { room } = await seeded([rect('a')]);
    const a = join(room, { cid: 'a' });
    for (let i = 1; i <= 120; i++) a.say({ type: 'changes', base: i - 1, changes: [set(rect('a', i))] });
    await vi.advanceTimersByTimeAsync(2500);
    const logs = [...state.data.keys()].filter((k) => k.startsWith('log:'));
    expect(logs).toHaveLength(100);
    expect(state.data.has('log:20')).toBe(false);
    expect(state.data.has('log:21')).toBe(true);
  });

  it('removes a deleted element from storage', async () => {
    const { room } = await seeded([rect('a'), rect('b')]);
    join(room, { cid: 'a' }).say({ type: 'changes', base: 0, changes: [del('a')] });
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.data.has('el:a')).toBe(false);
    expect(state.data.get('order')).toEqual(['b']);
  });

  it('keeps the map, the revision and the log for the next visitor, even across a restart', async () => {
    const room = await openRoom();
    const a = join(room, { cid: 'a' });
    a.say({ type: 'doc', name: 'Crypt', elements: [rect('a'), rect('b')] });
    const epoch = a.last().epoch;
    a.say({ type: 'changes', base: 0, changes: [set(rect('b', 40)), { t: 'order', ids: ['b', 'a'] }] });
    a.emit('close'); // the last one out saves at once, without waiting for the timer
    await vi.advanceTimersByTimeAsync(0);

    const restarted = await openRoom(); // a fresh object loading from storage
    expect(mapOf(restarted)).toEqual({
      type: 'doc',
      fresh: false,
      epoch,
      rev: 1,
      name: 'Crypt',
      elements: [rect('b', 40), rect('a')],
    });
    // and it still knows what happened, so a client at revision 0 is caught up and a stale edit is refused
    expect(join(restarted, { cid: 'x', since: 0, epoch }).last().changes).toEqual([
      set(rect('b', 40)),
      { t: 'order', ids: ['b', 'a'] },
    ]);
    join(restarted, { cid: 'y' }).say({ type: 'changes', base: 0, changes: [set(rect('b', 1))] });
    expect(mapOf(restarted).elements).toEqual([rect('b', 40), rect('a')]);
  });

  it('is deleted a week after the last visit, a visit pushes that back, and then it is fresh again', async () => {
    const start = Date.now();
    const { room } = await seeded([rect('a')]);
    expect(state.alarm).toBe(start + 2000 + WEEK); // set when the burst was saved

    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60 * 1000);
    join(room, { cid: 'a' });
    expect(state.alarm).toBe(Date.now() + WEEK);

    await room.alarm();
    expect(state.data.size).toBe(0);
    expect(join(room, { cid: 'b' }).last()).toMatchObject({ type: 'doc', fresh: true, rev: 0, elements: [] });
  });
});
