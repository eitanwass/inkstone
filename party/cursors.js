// ── Cursor relay (Cloudflare Worker + Durable Object) ───────────
// Where everyone's pointer is, streamed live. It is a second socket per session, at /cursors/<room>
// (see the Worker's fetch in server.js) and a second Durable Object, kept apart from the map's relay
// (InkstoneRoom) on purpose: cursors are frequent, worth nothing a moment later, and must never delay a
// change to the map. So this keeps nothing (no storage, no log, no alarm), forwards each position to
// the others at once, drops positions that come faster than MIN_GAP_MS from one client, and tells the
// others when a cursor goes (the pointer left the map, or the client did).
//
// Connections use the WebSocket Hibernation API (see server.js): the object is billed only while it is
// working, and who a socket is (its cid and player id) is kept with the socket (`serializeAttachment`).
//
// What a client may say, and is told (coordinates are in world units, as in the map):
//   { type: 'hello', cid, id }       who this is: cid is this tab, id the player (their id)
//   { type: 'cursor', x, y }         where the pointer is
//   { type: 'hide' }                 the pointer left the map
// and the others are told { type: 'cursor', cid, id, x, y } or { type: 'gone', cid }.

const MIN_GAP_MS = 50; // the client sends every 100 ms, so this only stops a flood
const MAX_COORD = 1e7;
const MAX_MESSAGE_LENGTH = 200;

// Kept in step by hand with src/collab/changes.ts, which this file can't import.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v) => typeof v === 'string' && ID_RE.test(v);
const isCoord = (v) => typeof v === 'number' && Math.abs(v) <= MAX_COORD; // false for NaN too

// A message from a client, checked, or null.
export function parseCursorMessage(text) {
  if (typeof text !== 'string' || text.length > MAX_MESSAGE_LENGTH) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  if (data.type === 'hello')
    return isId(data.cid) && isId(data.id) ? { type: 'hello', cid: data.cid, id: data.id } : null;
  if (data.type === 'cursor')
    return isCoord(data.x) && isCoord(data.y) ? { type: 'cursor', x: data.x, y: data.y } : null;
  return data.type === 'hide' ? { type: 'hide' } : null;
}

export class CursorRoom {
  constructor(state) {
    this.state = state;
    this.lastSent = new WeakMap(); // socket -> when its last position was passed on (forgotten if dropped from memory: fine)
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(ws) {
    this.state.acceptWebSocket(ws);
  }

  // Who a socket is ({ cid, id }), once it has said hello.
  sessionOf(ws) {
    return ws.deserializeAttachment() ?? null;
  }

  tellOthers(ws, message) {
    const text = JSON.stringify(message);
    for (const other of this.state.getWebSockets()) {
      if (other !== ws && this.sessionOf(other)) other.send(text);
    }
  }

  webSocketMessage(ws, data) {
    const message = parseCursorMessage(data);
    if (!message) return;
    if (message.type === 'hello') {
      ws.serializeAttachment({ cid: message.cid, id: message.id });
      return;
    }
    const session = this.sessionOf(ws);
    if (!session) return; // nothing is taken from a client that hasn't said hello
    if (message.type === 'hide') {
      this.tellOthers(ws, { type: 'gone', cid: session.cid });
      return;
    }
    const now = Date.now();
    if (now - (this.lastSent.get(ws) ?? 0) < MIN_GAP_MS) return; // a flood: the next position will do
    this.lastSent.set(ws, now);
    this.tellOthers(ws, { type: 'cursor', cid: session.cid, id: session.id, x: message.x, y: message.y });
  }

  webSocketClose(ws) {
    try {
      ws.close(1000); // answers the client's close
    } catch {
      // already closed
    }
    this.leave(ws);
  }

  webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const session = this.sessionOf(ws);
    if (!session) return;
    ws.serializeAttachment(null); // it may still be listed while it closes
    this.tellOthers(ws, { type: 'gone', cid: session.cid });
  }
}
