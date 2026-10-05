// ── Collab relay (Cloudflare Worker + Durable Object) ───────────
// One Durable Object instance per session id. It keeps the map as one entry per element (by id),
// applies the changes clients send (see src/collab/changes.ts: set, del, order, name) and passes them
// on, so two people editing different elements never overwrite each other. The same element edited at
// the same moment is last-write-wins. A client that connects is sent the whole map.
//
// The map is kept in the object's storage (one row per element, so an edit writes one row, not the
// whole map), so someone opening the link after everyone has left finds it as it was. A room is
// deleted a week after its last visit (an alarm), so abandoned rooms don't fill the free plan's
// storage. Until a room has been written to it is "fresh", and the first client to connect gives it
// its map (see src/collab/collab.ts).
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

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 2000; // edits come in bursts; one write per burst
const STORAGE_BATCH = 128; // Durable Object storage takes at most this many keys per call

// The limits keep one room's size, and the message that carries it to someone joining, under
// Cloudflare's 1 MiB per message. A change that would go over is dropped, so a room that big stops
// taking additions. ponytail: tell the sender, if it is ever reached.
const MAX_ELEMENT_LENGTH = 150_000;
const MAX_ELEMENTS = 2000;
const MAX_TOTAL_LENGTH = 900_000;
const MAX_NAME_LENGTH = 200;

// Kept in step by hand with src/collab/changes.ts, which this file can't import.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TYPES = ['rect', 'wall', 'token', 'label'];

const isObject = (v) => typeof v === 'object' && v !== null;
const isId = (v) => typeof v === 'string' && ID_RE.test(v); // test() alone would turn 42 into "42"

// An element's JSON text if it can be kept (it has an id and a known type, and isn't huge), else null.
// What is inside it is checked by the clients that receive it (src/core/validate.ts).
function elementJson(el) {
  if (!isObject(el) || !isId(el.id) || !TYPES.includes(el.type)) return null;
  const json = JSON.stringify(el);
  return json.length <= MAX_ELEMENT_LENGTH ? json : null;
}

// A message from a client, checked and in a form the room can use, or null if any part of it is
// wrong (all of it is dropped then: what is stored lasts).
//   { type: 'doc', name, elements }  -> { type, name, sets: [[id, json]] }
//   { type: 'changes', changes }     -> { type, changes: [...] }, each set carrying its json
export function parseMessage(text) {
  if (typeof text !== 'string' || text.length > MAX_TOTAL_LENGTH) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  if (data.type === 'doc') {
    if (!Array.isArray(data.elements) || data.elements.length > MAX_ELEMENTS) return null;
    const name = data.name ?? '';
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return null;
    const sets = data.elements.map((el) => [el?.id, elementJson(el)]);
    return sets.some(([, json]) => json === null) ? null : { type: 'doc', name, sets };
  }
  if (data.type !== 'changes' || !Array.isArray(data.changes)) return null;
  const changes = [];
  for (const c of data.changes) {
    if (!isObject(c)) return null;
    if (c.t === 'set') {
      const json = elementJson(c.el);
      if (json === null) return null;
      changes.push({ t: 'set', id: c.el.id, json });
    } else if (c.t === 'del' && isId(c.id)) {
      changes.push({ t: 'del', id: c.id });
    } else if (c.t === 'order' && Array.isArray(c.ids) && c.ids.length <= MAX_ELEMENTS && c.ids.every(isId)) {
      changes.push({ t: 'order', ids: c.ids });
    } else if (c.t === 'name' && typeof c.name === 'string' && c.name.length <= MAX_NAME_LENGTH) {
      changes.push({ t: 'name', name: c.name });
    } else {
      return null;
    }
  }
  return { type: 'changes', changes };
}

export class InkstoneRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Set();
    this.elements = new Map(); // id -> the element's JSON text; the map's order is the room's order
    this.total = 0; // the length of all the JSON texts
    this.name = '';
    this.initialized = false; // false until a client has given the room its map
    this.dirty = new Set(); // ids to write (or delete) at the next save
    this.orderDirty = false;
    this.metaDirty = false;
    this.saveTimer = null;
    this.ready = state.blockConcurrencyWhile(() => this.load());
  }

  async load() {
    const stored = await this.state.storage.list();
    const meta = stored.get('meta');
    this.name = meta?.name ?? '';
    this.initialized = !!meta;
    for (const id of stored.get('order') ?? []) this.keep(id, stored.get(`el:${id}`));
    for (const [key, json] of stored) if (key.startsWith('el:')) this.keep(key.slice(3), json);
  }

  // Puts an element in (a new one goes last, an old one keeps its place); false if it doesn't fit.
  keep(id, json) {
    if (typeof json !== 'string') return false;
    const old = this.elements.get(id);
    if (old === undefined && this.elements.size >= MAX_ELEMENTS) return false;
    if (this.total - (old?.length ?? 0) + json.length > MAX_TOTAL_LENGTH) return false;
    this.total += json.length - (old?.length ?? 0);
    this.elements.set(id, json);
    return true;
  }

  apply(message) {
    this.initialized = true;
    this.metaDirty = true;
    this.orderDirty = true; // cheap to rewrite, and sets and deletes change it anyway
    if (message.type === 'doc') {
      this.elements.clear();
      this.total = 0;
      for (const [id, json] of message.sets) this.keep(id, json);
      this.name = message.name;
      this.dirty = new Set(this.elements.keys());
      return;
    }
    // Sets, then deletes, then the last order: how changes.ts applies them.
    for (const c of message.changes) {
      if (c.t === 'set' && this.keep(c.id, c.json)) this.dirty.add(c.id);
    }
    for (const c of message.changes) {
      if (c.t === 'del' && this.elements.has(c.id)) {
        this.total -= this.elements.get(c.id).length;
        this.elements.delete(c.id);
        this.dirty.add(c.id);
      }
    }
    const order = message.changes.findLast((c) => c.t === 'order');
    if (order) {
      const sorted = new Map();
      for (const id of order.ids) if (this.elements.has(id)) sorted.set(id, this.elements.get(id));
      for (const [id, json] of this.elements) if (!sorted.has(id)) sorted.set(id, json);
      this.elements = sorted;
    }
    const rename = message.changes.findLast((c) => c.t === 'name');
    if (rename) this.name = rename.name;
  }

  // The whole map as the message a connecting client gets, built from the stored texts as they are.
  documentMessage() {
    const elements = [...this.elements.values()].join(',');
    return `{"type":"doc","fresh":${!this.initialized},"name":${JSON.stringify(this.name)},"elements":[${elements}]}`;
  }

  // Writes what has changed since the last save, and pushes the room's deletion a week on from now.
  async save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const writes = [];
    const deletes = [];
    for (const id of this.dirty) {
      const json = this.elements.get(id);
      if (json === undefined) deletes.push(`el:${id}`);
      else writes.push([`el:${id}`, json]);
    }
    if (this.orderDirty) writes.push(['order', [...this.elements.keys()]]);
    if (this.metaDirty) writes.push(['meta', { name: this.name }]);
    this.dirty = new Set();
    this.orderDirty = this.metaDirty = false;
    for (let i = 0; i < writes.length; i += STORAGE_BATCH) {
      await this.state.storage.put(Object.fromEntries(writes.slice(i, i + STORAGE_BATCH)));
    }
    for (let i = 0; i < deletes.length; i += STORAGE_BATCH) {
      await this.state.storage.delete(deletes.slice(i, i + STORAGE_BATCH));
    }
    if (this.initialized) await this.state.storage.setAlarm(Date.now() + RETENTION_MS);
  }

  async alarm() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.elements.clear();
    this.total = 0;
    this.name = '';
    this.initialized = false;
    this.dirty = new Set();
    this.orderDirty = this.metaDirty = false;
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
    ws.send(this.documentMessage());
    // A visit keeps the room another week.
    if (this.initialized) this.state.storage.setAlarm(Date.now() + RETENTION_MS);

    ws.addEventListener('message', (evt) => {
      const message = parseMessage(evt.data);
      if (!message) return;
      if (message.type === 'doc' && this.initialized) {
        ws.send(this.documentMessage()); // too late to give the room a map: here is its map
        return;
      }
      this.apply(message);
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
