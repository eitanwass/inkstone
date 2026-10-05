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
    last: () => JSON.parse(sent[sent.length - 1]),
  };
}

const rect = (id: string, x = 0) => ({ type: 'rect', id, x, y: 0, w: 40, h: 40 });
const doc = (elements: unknown[], name = '') => JSON.stringify({ type: 'doc', name, elements });
const changes = (list: unknown[]) => JSON.stringify({ type: 'changes', changes: list });
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function openRoom(s = state) {
  const room = new InkstoneRoom(s);
  await room.ready;
  return room;
}

// A client that has connected and been told the room (so, unlike a bare socket, it is in the room).
function join(room: InstanceType<typeof InkstoneRoom>) {
  const ws = fakeSocket();
  room.handleSession(ws);
  return ws;
}

// Seeds a room with these elements, as the first client would, and lets it save.
async function seeded(elements: unknown[], name = '') {
  const room = await openRoom();
  const first = join(room);
  first.emit('message', doc(elements, name));
  await vi.advanceTimersByTimeAsync(2500);
  return { room, first };
}

beforeEach(() => {
  vi.useFakeTimers();
  state = fakeState();
});
afterEach(() => vi.useRealTimers());

describe('parseMessage', () => {
  it('accepts a doc and the four kinds of change', () => {
    expect(parseMessage(doc([rect('a')], 'N'))).toMatchObject({ type: 'doc', name: 'N' });
    const list = [
      { t: 'set', el: rect('a') },
      { t: 'del', id: 'b' },
      { t: 'order', ids: ['a'] },
      { t: 'name', name: 'N' },
    ];
    expect(parseMessage(changes(list))).toMatchObject({ type: 'changes' });
  });

  it('refuses anything else, whole', () => {
    const bad = [
      '',
      'nope',
      '[]',
      '{}',
      'null',
      42,
      null,
      '{"type":"snapshot","elements":[]}',
      doc([{ type: 'rect', x: 0 }]), // no id
      doc([{ type: 'hologram', id: 'a' }]),
      doc([rect('no spaces')]),
      doc([rect('a')], 'x'.repeat(201)),
      doc([{ ...rect('a'), pad: 'x'.repeat(150_000) }]),
      changes([{ t: 'del', id: 'a' }, { t: 'explode' }]), // one bad change spoils the message
      changes([{ t: 'order', ids: [1] }]),
      `{"type":"changes","changes":[],"pad":"${'x'.repeat(900_000)}"}`,
    ];
    for (const message of bad) expect(parseMessage(message), String(message).slice(0, 60)).toBeNull();
  });
});

describe('the room', () => {
  it('is fresh until someone gives it a map, and the first one to do so gets to', async () => {
    const room = await openRoom();
    const a = join(room);
    expect(a.last()).toEqual({ type: 'doc', fresh: true, name: '', elements: [] });
    const b = join(room);
    expect(b.last().fresh).toBe(true);

    a.emit('message', doc([rect('a')], 'Mine'));
    b.emit('message', doc([rect('b')], 'Theirs')); // too late
    expect(b.last()).toEqual({ type: 'doc', fresh: false, name: 'Mine', elements: [rect('a')] });
    expect(join(room).last()).toMatchObject({ fresh: false, name: 'Mine', elements: [rect('a')] });
  });

  it('applies changes to the map and passes them on to the others, not back', async () => {
    const room = await openRoom();
    const [a, b] = [join(room), join(room)];
    a.emit('message', doc([rect('a'), rect('b')]));
    const edit = changes([
      { t: 'set', el: rect('b', 80) },
      { t: 'set', el: rect('c') },
      { t: 'del', id: 'a' },
    ]);
    b.emit('message', edit);
    expect(a.sent.at(-1)).toBe(edit);
    expect(b.sent.at(-1)).not.toBe(edit);
    expect(join(room).last().elements).toEqual([rect('b', 80), rect('c')]);
  });

  it("keeps two people's edits to different elements", async () => {
    const room = await openRoom();
    const [a, b] = [join(room), join(room)];
    a.emit('message', doc([rect('a'), rect('b')]));
    a.emit('message', changes([{ t: 'set', el: rect('a', 40) }]));
    b.emit('message', changes([{ t: 'set', el: rect('b', 80) }]));
    expect(join(room).last().elements).toEqual([rect('a', 40), rect('b', 80)]);
  });

  it('reorders, and renames without touching the map', async () => {
    const room = await openRoom();
    const a = join(room);
    a.emit('message', doc([rect('a'), rect('b'), rect('c')], 'Old'));
    a.emit('message', changes([{ t: 'order', ids: ['c', 'a', 'b'] }]));
    a.emit('message', changes([{ t: 'name', name: 'New' }]));
    expect(join(room).last()).toMatchObject({ name: 'New', elements: [rect('c'), rect('a'), rect('b')] });
  });

  it('drops a bad message: not applied, not passed on, not kept', async () => {
    const room = await openRoom();
    const [a, b] = [join(room), join(room)];
    a.emit('message', doc([rect('a')]));
    const before = b.sent.length;
    a.emit('message', changes([{ t: 'set', el: { type: 'rect' } }]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.sent.length).toBe(before); // nothing was passed on
    expect(join(room).last().elements).toEqual([rect('a')]);
  });

  it('stops taking elements past its limit', async () => {
    const room = await openRoom();
    const a = join(room);
    a.emit('message', doc([rect('a')]));
    const many = Array.from({ length: 2100 }, (_, i) => ({ t: 'set', el: rect(`e${i}`) }));
    a.emit('message', changes(many));
    expect(join(room).last().elements).toHaveLength(2000);
  });
});

describe('saving', () => {
  it('writes once per burst of edits, and only the elements that changed', async () => {
    const { room, first } = await seeded([rect('a'), rect('b'), rect('c')], 'Crypt');
    expect(state.data.get('el:a')).toBe(JSON.stringify(rect('a')));
    expect(state.data.get('order')).toEqual(['a', 'b', 'c']);
    expect(state.data.get('meta')).toEqual({ name: 'Crypt' });

    const writesBefore = state.writes;
    state.data.set('el:c', 'UNTOUCHED'); // a row that must not be rewritten by an edit to a
    for (let i = 1; i <= 5; i++) first.emit('message', changes([{ t: 'set', el: rect('a', i) }]));
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.writes).toBe(writesBefore + 1);
    expect(state.data.get('el:a')).toBe(JSON.stringify(rect('a', 5)));
    expect(state.data.get('el:c')).toBe('UNTOUCHED');
    expect(room).toBeDefined();
  });

  it('removes a deleted element from storage', async () => {
    const { first } = await seeded([rect('a'), rect('b')]);
    first.emit('message', changes([{ t: 'del', id: 'a' }]));
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.data.has('el:a')).toBe(false);
    expect(state.data.get('order')).toEqual(['b']);
  });

  it('keeps the map for the next visitor after everyone has left, even across a restart', async () => {
    const room = await openRoom();
    const a = join(room);
    a.emit('message', doc([rect('a'), rect('b')], 'Crypt'));
    a.emit(
      'message',
      changes([
        { t: 'set', el: rect('b', 40) },
        { t: 'order', ids: ['b', 'a'] },
      ]),
    );
    a.emit('close'); // the last one out saves at once, without waiting for the timer
    await vi.advanceTimersByTimeAsync(0);

    const later = join(await openRoom()); // a fresh object loading from storage
    expect(later.last()).toEqual({
      type: 'doc',
      fresh: false,
      name: 'Crypt',
      elements: [rect('b', 40), rect('a')],
    });
  });

  it('is deleted a week after the last visit, a visit pushes that back, and then it is fresh again', async () => {
    const start = Date.now();
    const { room } = await seeded([rect('a')]);
    expect(state.alarm).toBe(start + 2000 + WEEK); // set when the burst was saved

    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60 * 1000);
    join(room);
    expect(state.alarm).toBe(Date.now() + WEEK);

    await room.alarm();
    expect(state.data.size).toBe(0);
    expect(join(room).last()).toEqual({ type: 'doc', fresh: true, name: '', elements: [] });
  });
});
