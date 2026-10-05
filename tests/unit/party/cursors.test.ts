import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorRoom, parseCursorMessage } from '../../../party/cursors.js';

function fakeSocket() {
  const listeners: Record<string, (e: { data: string }) => void> = {};
  const sent: unknown[] = [];
  return {
    sent,
    accept() {},
    send: (m: string) => void sent.push(JSON.parse(m)),
    addEventListener: (type: string, fn: (e: { data: string }) => void) => {
      listeners[type] = fn;
    },
    emit: (type: string) => listeners[type]({ data: '' }),
    say: (message: unknown) => listeners.message({ data: JSON.stringify(message) }),
  };
}

function join(room: CursorRoom, cid: string) {
  const ws = fakeSocket();
  room.handleSession(ws);
  ws.say({ type: 'hello', cid, id: `a-${cid}` });
  return ws;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('parseCursorMessage', () => {
  it('accepts hello, a position and hide', () => {
    expect(parseCursorMessage('{"type":"hello","cid":"c1","id":"a1"}')).toEqual({
      type: 'hello',
      cid: 'c1',
      id: 'a1',
    });
    expect(parseCursorMessage('{"type":"cursor","x":10,"y":-4.5}')).toEqual({
      type: 'cursor',
      x: 10,
      y: -4.5,
    });
    expect(parseCursorMessage('{"type":"hide"}')).toEqual({ type: 'hide' });
  });

  it('drops anything else', () => {
    for (const text of [
      '',
      'nope',
      '[]',
      '{"type":"cursor","x":"1","y":2}',
      '{"type":"cursor","x":1e9,"y":2}',
      '{"type":"cursor","x":null,"y":2}',
      '{"type":"hello","cid":"bad id","id":"a1"}',
      '{"type":"doc"}',
      `{"type":"hide","pad":"${'x'.repeat(300)}"}`,
    ]) {
      expect(parseCursorMessage(text)).toBeNull();
    }
  });
});

describe('the cursor room', () => {
  it('passes a position on to the others, not back to the sender', () => {
    const room = new CursorRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    a.say({ type: 'cursor', x: 5, y: 6 });
    expect(b.sent).toEqual([{ type: 'cursor', cid: 'a', id: 'a-a', x: 5, y: 6 }]);
    expect(a.sent).toEqual([]);
  });

  it('drops positions that come too fast, and takes the next one after the gap', () => {
    const room = new CursorRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    a.say({ type: 'cursor', x: 1, y: 1 });
    a.say({ type: 'cursor', x: 2, y: 2 });
    expect(b.sent).toHaveLength(1);
    vi.advanceTimersByTime(50);
    a.say({ type: 'cursor', x: 3, y: 3 });
    expect(b.sent).toHaveLength(2);
  });

  it('says a cursor is gone when the pointer leaves the map or the client leaves', () => {
    const room = new CursorRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    a.say({ type: 'hide' });
    expect(b.sent).toEqual([{ type: 'gone', cid: 'a' }]);
    a.emit('close');
    expect(b.sent).toHaveLength(2);
  });

  it('takes nothing from a client that has not said hello, and says nothing when it leaves', () => {
    const room = new CursorRoom();
    const b = join(room, 'b');
    const silent = fakeSocket();
    room.handleSession(silent);
    silent.say({ type: 'cursor', x: 1, y: 1 });
    silent.emit('close');
    expect(b.sent).toEqual([]);
  });
});
