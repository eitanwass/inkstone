import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InkstoneRoom, isSnapshot } from '../../../party/server.js';

// The relay's storage is faked with a Map; Cloudflare's own behaviour (blockConcurrencyWhile holding
// back requests until the load is done) is relied on, not tested.
function fakeState(data = new Map<string, string>()) {
  return {
    data,
    alarm: null as number | null,
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    storage: {
      get: async (k: string) => data.get(k),
      put: async (k: string, v: string) => void data.set(k, v),
      setAlarm: async function (this: unknown, t: number) {
        state.alarm = t;
      },
      deleteAll: async () => data.clear(),
    },
  };
}
let state: ReturnType<typeof fakeState>;

function fakeSocket() {
  const listeners: Record<string, (e: { data: string }) => void> = {};
  return {
    sent: [] as string[],
    accept() {},
    send(m: string) {
      this.sent.push(m);
    },
    addEventListener: (type: string, fn: (e: { data: string }) => void) => {
      listeners[type] = fn;
    },
    emit: (type: string, data = '') => listeners[type]({ data }),
  };
}

const map = JSON.stringify({ name: 'Crypt', elements: [{ type: 'rect', x: 0, y: 0, w: 40, h: 40 }] });
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function openRoom(s = state) {
  const room = new InkstoneRoom(s);
  await room.ready;
  return room;
}

beforeEach(() => {
  vi.useFakeTimers();
  state = fakeState();
});
afterEach(() => vi.useRealTimers());

describe('isSnapshot', () => {
  it('accepts a map snapshot', () => {
    expect(isSnapshot(map)).toBe(true);
  });

  it('refuses anything else', () => {
    for (const bad of [
      '[]',
      '',
      'nope',
      '{}',
      '{"elements":3}',
      'null',
      '42',
      42,
      null,
      'x'.repeat(1_000_001),
    ]) {
      expect(isSnapshot(bad)).toBe(false);
    }
  });
});

describe('the room', () => {
  it('passes a snapshot on to the others and keeps it for someone who joins later', async () => {
    const room = await openRoom();
    const [a, b] = [fakeSocket(), fakeSocket()];
    room.handleSession(a);
    room.handleSession(b);
    a.emit('message', map);
    expect(b.sent).toEqual([map]);
    expect(a.sent).toEqual([]);
    const late = fakeSocket();
    room.handleSession(late);
    expect(late.sent).toEqual([map]);
  });

  it('writes to storage once per burst of edits, not once per edit', async () => {
    const room = await openRoom();
    const a = fakeSocket();
    room.handleSession(a);
    for (let i = 0; i < 5; i++) a.emit('message', map);
    expect(state.data.size).toBe(0);
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.data.get('doc')).toBe(map);
  });

  it('keeps the map for the next visitor after everyone has left, even across a restart', async () => {
    const room = await openRoom();
    const a = fakeSocket();
    room.handleSession(a);
    a.emit('message', map);
    a.emit('close'); // the last one out saves at once, without waiting for the timer
    await vi.advanceTimersByTimeAsync(0);
    expect(state.data.get('doc')).toBe(map);

    const later = fakeSocket();
    (await openRoom()).handleSession(later); // a fresh object loading from storage
    expect(later.sent).toEqual([map]);
  });

  it('drops a message that is not a snapshot: not passed on, not kept', async () => {
    const room = await openRoom();
    const [a, b] = [fakeSocket(), fakeSocket()];
    room.handleSession(a);
    room.handleSession(b);
    a.emit('message', 'garbage');
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.sent).toEqual([]);
    expect(state.data.size).toBe(0);
  });

  it('is deleted a week after the last visit, and a visit pushes that back', async () => {
    const start = Date.now();
    const room = await openRoom();
    const a = fakeSocket();
    room.handleSession(a);
    a.emit('message', map);
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.alarm).toBe(start + 2000 + WEEK); // set when the burst was saved

    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60 * 1000);
    room.handleSession(fakeSocket());
    expect(state.alarm).toBe(Date.now() + WEEK);

    await room.alarm();
    expect(state.data.size).toBe(0);
    const after = fakeSocket();
    room.handleSession(after);
    expect(after.sent).toEqual([]);
  });
});
