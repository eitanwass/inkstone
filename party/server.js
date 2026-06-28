// ── Collab relay (Cloudflare Worker + Durable Object) ───────────
// One Durable Object instance per session id. Pure relay, no merge logic —
// last message received wins, matching the client's last-write-wins sync
// model (see src/collab.js). `lastState` is kept in memory only so a client
// joining an already-active session gets caught up; it's not a durable
// store, since every client's own localStorage already has a copy.
//
// This talks directly to the Workers API (deployed via `wrangler`) rather
// than going through PartyKit's CLI/backend — PartyKit's hosted control
// plane currently provisions Durable Object namespaces in a way Cloudflare's
// free plan rejects (it requires the `new_sqlite_classes` migration style,
// see wrangler.toml), and that provisioning happens server-side on PartyKit's
// end, outside anything fixable from this repo. The client (`partysocket`)
// is unaware of the difference either way — it just opens a WebSocket at
// `/parties/<name>/<room>`, which is the URL shape preserved below so the
// frontend needed zero changes.

export class InkstoneRoom {
  constructor() {
    this.sessions = new Set();
    this.lastState = null;
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
    ws.accept();
    this.sessions.add(ws);
    if (this.lastState) ws.send(this.lastState);

    ws.addEventListener('message', (evt) => {
      this.lastState = evt.data;
      for (const session of this.sessions) {
        if (session !== ws) session.send(evt.data);
      }
    });

    const leave = () => this.sessions.delete(ws);
    ws.addEventListener('close', leave);
    ws.addEventListener('error', leave);
  }
}

// partysocket's default URL shape is /parties/<party-name>/<room-id>
// (party-name defaults to "main") — route purely on the trailing room id.
export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(/^\/parties\/[^/]+\/([^/]+)/);
    if (!match) return new Response('Not found', { status: 404 });
    const [, roomId] = match;
    const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
    return room.fetch(request);
  },
};
