// ── Collab relay (Cloudflare Worker + Durable Object) ───────────
// One Durable Object instance per session id. Pure relay, no merge logic —
// last message received wins, matching the client's last-write-wins sync
// model (see src/collab/collab.ts). The latest snapshot (`lastState`) is kept in
// the object's storage, so a client joining catches up even after everyone has
// left, and the room is deleted a week after its last visit (an alarm), so
// abandoned rooms don't fill the free plan's storage.
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

const MAX_STATE_LENGTH = 1_000_000; // characters; Cloudflare's own limit for a message is 1 MiB
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 2000; // edits come in bursts; one write per burst

// Only what the client sends is kept or passed on: a JSON map snapshot, `{ name, elements }`.
// Anything else is dropped here, since what is stored lasts.
// (Each element is checked by the clients that receive it, see src/core/validate.ts.)
export function isSnapshot(message) {
  if (typeof message !== 'string' || message.length > MAX_STATE_LENGTH) return false;
  try {
    const data = JSON.parse(message);
    return typeof data === 'object' && data !== null && Array.isArray(data.elements);
  } catch {
    return false;
  }
}

export class InkstoneRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Set();
    this.lastState = null;
    this.saveTimer = null;
    this.ready = state.blockConcurrencyWhile(async () => {
      this.lastState = (await state.storage.get('doc')) ?? null;
    });
  }

  // Writes the snapshot now, and pushes the room's deletion a week on from this visit.
  async save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.lastState === null) return;
    await this.state.storage.put('doc', this.lastState);
    await this.state.storage.setAlarm(Date.now() + RETENTION_MS);
  }

  async alarm() {
    this.lastState = null;
    await this.state.storage.deleteAll();
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
    if (this.lastState) {
      ws.send(this.lastState);
      this.state.storage.setAlarm(Date.now() + RETENTION_MS); // a visit keeps the room another week
    }

    ws.addEventListener('message', (evt) => {
      if (!isSnapshot(evt.data)) return;
      this.lastState = evt.data;
      this.saveTimer ??= setTimeout(() => this.save(), SAVE_DELAY_MS);
      for (const session of this.sessions) {
        if (session !== ws) session.send(evt.data);
      }
    });

    const leave = () => {
      this.sessions.delete(ws);
      if (!this.sessions.size && this.saveTimer) this.save(); // the last one out: keep what they left
    };
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
