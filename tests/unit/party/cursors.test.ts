import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorRoom, parseCursorMessage } from '../../../party/cursors.js';

// Sockets are faked the way a hibernating object sees them: Cloudflare keeps them (getWebSockets) with
// whatever was attached to each, and calls the room's webSocketMessage / webSocketClose by name.
interface FakeSocket {
  sent: unknown[];
  state: { room: CursorRoom };
  closed: boolean;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
  close(): void;
  send(m: string): void;
  emit(type: string): void;
  say(message: unknown): void;
}

function fakeState() {
  const sockets: FakeSocket[] = [];
  const state = {
    room: null as unknown as CursorRoom,
    acceptWebSocket(ws: FakeSocket) {
      ws.state = state;
      sockets.push(ws);
    },
    getWebSockets: () => sockets.filter((ws) => !ws.closed),
  };
  return state;
}

function fakeSocket(): FakeSocket {
  const sent: unknown[] = [];
  let attachment: unknown = null;
  const ws: FakeSocket = {
    sent,
    state: null as unknown as { room: CursorRoom },
    closed: false,
    serializeAttachment: (value: unknown) => {
      attachment = structuredClone(value);
    },
    deserializeAttachment: () => (attachment === null ? null : structuredClone(attachment)),
    close: () => {
      ws.closed = true;
    },
    send: (m: string) => void sent.push(JSON.parse(m)),
    emit: (type: string) =>
      type === 'close' ? ws.state.room.webSocketClose(ws) : ws.state.room.webSocketError(ws),
    say: (message: unknown) => ws.state.room.webSocketMessage(ws, JSON.stringify(message)),
  };
  return ws;
}

// A room, as Cloudflare would make it: with its state.
function openRoom() {
  const state = fakeState();
  const room = new CursorRoom(state);
  state.room = room;
  return room;
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
    const room = openRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    a.say({ type: 'cursor', x: 5, y: 6 });
    expect(b.sent).toEqual([{ type: 'cursor', cid: 'a', id: 'a-a', x: 5, y: 6 }]);
    expect(a.sent).toEqual([]);
  });

  it('drops positions that come too fast, and takes the next one after the gap', () => {
    const room = openRoom();
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
    const room = openRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    a.say({ type: 'hide' });
    expect(b.sent).toEqual([{ type: 'gone', cid: 'a' }]);
    a.emit('close');
    expect(b.sent).toHaveLength(2);
  });

  it('takes nothing from a client that has not said hello, and says nothing when it leaves', () => {
    const room = openRoom();
    const b = join(room, 'b');
    const silent = fakeSocket();
    room.handleSession(silent);
    silent.say({ type: 'cursor', x: 1, y: 1 });
    silent.emit('close');
    expect(b.sent).toEqual([]);
  });
});

describe('hibernation', () => {
  it('still knows who is here after the room was dropped from memory and made again', () => {
    const state = fakeState();
    const room = new CursorRoom(state);
    state.room = room;
    const a = join(room, 'a');
    const b = join(room, 'b');
    const woken = new CursorRoom(state); // nothing it knew in memory comes with it
    state.room = woken;
    a.say({ type: 'cursor', x: 5, y: 6 });
    expect(b.sent).toEqual([{ type: 'cursor', cid: 'a', id: 'a-a', x: 5, y: 6 }]);
    a.emit('close');
    expect(b.sent).toHaveLength(2);
  });
});
