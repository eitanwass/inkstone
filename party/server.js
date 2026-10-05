// ── Collab relay (Cloudflare Worker + Durable Object) ───────────
// One Durable Object instance per session id. It keeps the map as one entry per element (by id),
// applies the changes clients send (see src/collab/changes.ts: set, del, order, name) and passes them
// on, so two players editing different elements never overwrite each other.
//
// Every accepted batch of changes is a numbered revision (`rev`) with a small log entry saying who
// sent it and which elements it touched (not what it put in them, so the log is tiny). The relay is
// the source of truth: a client says which revision its batch was based on (`base`), and a change to
// something that was touched by someone else's later revision is refused, and the client is sent the
// room's version instead. The log is also how a client that was away is caught up: it says the last
// revision it has, and is sent the room's current version of whatever was touched since (or the
// whole map, if the log doesn't reach back that far).
//
// Token pictures are not part of the map: a token holds the id of one, and each picture is kept once
// (`img:<id>`), sent by a client when it first uses it and handed to any client that asks for it.
// First one wins: a picture's id is made from its content, so it never needs to change.
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

export { CursorRoom } from './cursors.js';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 2000; // edits come in bursts; one write per burst
const STORAGE_BATCH = 128; // Durable Object storage takes at most this many keys per call
const LOG_LIMIT = 100; // revisions kept: how far back a client can be caught up, and conflicts known

// The limits keep one room's size, and the message that carries it to someone joining, under
// Cloudflare's 1 MiB per message. A change that would go over is refused like a conflict.
const MAX_ELEMENT_LENGTH = 20_000;
const MAX_ELEMENTS = 2000;
const MAX_TOTAL_LENGTH = 900_000;
const MAX_NAME_LENGTH = 200;
const MAX_PLAYER_NAME_LENGTH = 40;
const MAX_IMAGE_LENGTH = 100_000; // the same raster-only check as src/core/image-data.ts
const MAX_IMAGES = 100;
const MAX_IMAGES_TOTAL_LENGTH = 1_500_000;
const MAX_IMAGES_PER_REQUEST = 50;
const MAX_PLAYERS_LISTED = 50; // the count is always the true one; only the list is cut

// Kept in step by hand with src/collab/changes.ts, which this file can't import.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TYPES = ['rect', 'wall', 'token', 'label'];

const isImageData = (v) =>
  typeof v === 'string' &&
  v.length <= MAX_IMAGE_LENGTH &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v);
const isObject = (v) => typeof v === 'object' && v !== null;
const isId = (v) => typeof v === 'string' && ID_RE.test(v); // test() alone would turn 42 into "42"
const isRev = (v) => Number.isInteger(v) && v >= 0;
const newEpoch = () => crypto.randomUUID().replaceAll('-', '').slice(0, 16);

// An element's JSON text if it can be kept (it has an id and a known type, and isn't huge), else null.
// What is inside it is checked by the clients that receive it (src/core/validate.ts).
function elementJson(el) {
  if (!isObject(el) || !isId(el.id) || !TYPES.includes(el.type)) return null;
  const json = JSON.stringify(el);
  return json.length <= MAX_ELEMENT_LENGTH ? json : null;
}

// A message from a client, checked and in a form the room can use, or null if any part of it is
// wrong (all of it is dropped then: what is stored lasts).
//   { type: 'hello', cid, player: { id, name }, epoch?, since? }
//        who is connecting (cid is this tab; player is who they are) and, for a client that has been in
//        this room before, the room's epoch and the last revision it has
//   { type: 'doc', name, elements }       a map to give a fresh room
//   { type: 'changes', base, changes }    changes made on top of revision `base`
//   { type: 'rename', name }              the player's new name (a client that has said hello)
//   { type: 'image', id, data }           a token picture, which the room keeps if it hasn't got it
//   { type: 'getimages', ids }            asks for pictures, each answered with an `image` message
// and the room tells everyone `{ type: 'presence', count, players: [{ id, name }] }` when someone arrives
// or leaves.
export function parseMessage(text) {
  if (typeof text !== 'string' || text.length > MAX_TOTAL_LENGTH) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  if (data.type === 'hello') {
    const { cid, player, epoch, since } = data;
    if (!isId(cid) || !isObject(player) || !isId(player.id)) return null;
    if (typeof player.name !== 'string' || player.name.length > MAX_PLAYER_NAME_LENGTH) return null;
    if ((epoch !== undefined && !isId(epoch)) || (since !== undefined && !isRev(since))) return null;
    return { type: 'hello', cid, player: { id: player.id, name: player.name }, epoch, since };
  }
  if (data.type === 'rename') {
    const ok =
      typeof data.name === 'string' && data.name.length > 0 && data.name.length <= MAX_PLAYER_NAME_LENGTH;
    return ok ? { type: 'rename', name: data.name } : null;
  }
  if (data.type === 'image') {
    return isId(data.id) && isImageData(data.data) ? { type: 'image', id: data.id, data: data.data } : null;
  }
  if (data.type === 'getimages') {
    const ok = Array.isArray(data.ids) && data.ids.length <= MAX_IMAGES_PER_REQUEST && data.ids.every(isId);
    return ok ? { type: 'getimages', ids: data.ids } : null;
  }
  if (data.type === 'doc') {
    if (!Array.isArray(data.elements) || data.elements.length > MAX_ELEMENTS) return null;
    const name = data.name ?? '';
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return null;
    const sets = data.elements.map((el) => [el?.id, elementJson(el)]);
    return sets.some(([, json]) => json === null) ? null : { type: 'doc', name, sets };
  }
  if (data.type !== 'changes' || !isRev(data.base) || !Array.isArray(data.changes)) return null;
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
  return { type: 'changes', base: data.base, changes };
}

// A change as the text that goes over the wire.
const wire = (c) => (c.t === 'set' ? `{"t":"set","el":${c.json}}` : JSON.stringify(c));

export class InkstoneRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Map(); // socket -> { cid, player }, once it has said hello
    this.elements = new Map(); // id -> the element's JSON text; the map's order is the room's order
    this.total = 0; // the length of all the JSON texts
    this.name = '';
    this.initialized = false; // false until a client has given the room its map
    this.epoch = ''; // names this life of the room, so a client can tell if it was deleted and remade
    this.rev = 0;
    this.log = []; // { rev, cid, by: { id, name }, at, ids, order, name }, the last LOG_LIMIT
    this.images = new Map(); // id -> the picture's data URL
    this.imagesTotal = 0;
    this.imageWrites = new Set(); // picture ids to write at the next save
    this.dirty = new Set(); // ids to write (or delete) at the next save
    this.logWrites = new Set(); // revisions to write
    this.logDeletes = new Set(); // revisions to delete
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
    this.epoch = meta?.epoch ?? '';
    this.rev = meta?.rev ?? 0;
    for (const id of stored.get('order') ?? []) this.keep(id, stored.get(`el:${id}`));
    for (const [key, json] of stored) if (key.startsWith('el:')) this.keep(key.slice(3), json);
    for (const [key, data] of stored) {
      if (key.startsWith('img:') && isImageData(data)) this.addImage(key.slice(4), data);
    }
    this.log = [...stored]
      .filter(([key]) => key.startsWith('log:'))
      .map(([, entry]) => entry)
      .sort((a, b) => a.rev - b.rev);
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

  // Keeps a picture the room hasn't got; false if it has it or it doesn't fit.
  addImage(id, data) {
    if (this.images.has(id) || this.images.size >= MAX_IMAGES) return false;
    if (this.imagesTotal + data.length > MAX_IMAGES_TOTAL_LENGTH) return false;
    this.images.set(id, data);
    this.imagesTotal += data.length;
    return true;
  }

  // Gives a fresh room its map: the room's first revision is 0, and it has a new epoch.
  seed(message) {
    this.initialized = true;
    this.epoch = newEpoch();
    this.rev = 0;
    this.log = [];
    this.metaDirty = this.orderDirty = true;
    this.elements.clear();
    this.total = 0;
    for (const [id, json] of message.sets) this.keep(id, json);
    this.name = message.name;
    this.dirty = new Set(this.elements.keys());
  }

  // Applies changes already checked for conflicts: sets, then deletes, then the last order, then the
  // name, which is how changes.ts applies them. Returns the ids of sets that didn't fit.
  applyChanges(changes) {
    this.metaDirty = this.orderDirty = true; // cheap to rewrite, and sets and deletes change it anyway
    const failed = [];
    for (const c of changes) {
      if (c.t !== 'set') continue;
      if (this.keep(c.id, c.json)) this.dirty.add(c.id);
      else failed.push(c.id);
    }
    for (const c of changes) {
      if (c.t === 'del' && this.elements.has(c.id)) {
        this.total -= this.elements.get(c.id).length;
        this.elements.delete(c.id);
        this.dirty.add(c.id);
      }
    }
    const order = changes.findLast((c) => c.t === 'order');
    if (order) {
      const sorted = new Map();
      for (const id of order.ids) if (this.elements.has(id)) sorted.set(id, this.elements.get(id));
      for (const [id, json] of this.elements) if (!sorted.has(id)) sorted.set(id, json);
      this.elements = sorted;
    }
    const rename = changes.findLast((c) => c.t === 'name');
    if (rename) this.name = rename.name;
    return failed;
  }

  // The whole map as the message a client gets when it has nothing to be caught up from, built from
  // the stored texts as they are.
  documentMessage() {
    const elements = [...this.elements.values()].join(',');
    return `{"type":"doc","fresh":${!this.initialized},"epoch":"${this.epoch}","rev":${this.rev},"name":${JSON.stringify(this.name)},"elements":[${elements}]}`;
  }

  // The room's version of things, as changes: each of these elements as it is now (or deleted), and
  // the order and the name if asked. Used both to catch a client up and to correct one that was refused.
  currentAs(ids, order, name) {
    const changes = [];
    for (const id of ids) {
      const json = this.elements.get(id);
      changes.push(json === undefined ? JSON.stringify({ t: 'del', id }) : `{"t":"set","el":${json}}`);
    }
    if (order) changes.push(JSON.stringify({ t: 'order', ids: [...this.elements.keys()] }));
    if (name) changes.push(JSON.stringify({ t: 'name', name: this.name }));
    return changes;
  }

  // What happened since revision `since`, as the touched ids, and whether order and name were touched.
  touchedSince(since, exceptCid = null) {
    const touched = { ids: new Set(), order: false, name: false };
    for (const entry of this.log) {
      if (entry.rev <= since || entry.cid === exceptCid) continue;
      for (const id of entry.ids) touched.ids.add(id);
      touched.order ||= entry.order;
      touched.name ||= entry.name;
    }
    return touched;
  }

  // Whether the log reaches back to revision `since`, so what happened after it is known.
  covers(since) {
    return since >= this.rev || (this.log.length > 0 && this.log[0].rev <= since + 1);
  }

  hello(ws, { epoch, since }) {
    const caughtUp = this.initialized && epoch === this.epoch && since !== undefined && since <= this.rev;
    if (!caughtUp || !this.covers(since)) {
      ws.send(this.documentMessage());
      return;
    }
    const { ids, order, name } = this.touchedSince(since);
    const changes = this.currentAs(ids, order, name).join(',');
    ws.send(`{"type":"catchup","epoch":"${this.epoch}","rev":${this.rev},"changes":[${changes}]}`);
  }

  // Who is here: one per player (the same player in two tabs is one), as the message every client
  // gets when someone arrives or leaves. `count` is everyone; `players` is cut to a sensible length.
  presenceMessage() {
    const players = new Map();
    for (const { player } of this.sessions.values())
      players.set(player.id, { id: player.id, name: player.name });
    return JSON.stringify({
      type: 'presence',
      count: players.size,
      players: [...players.values()].slice(0, MAX_PLAYERS_LISTED),
    });
  }

  sendPresence() {
    const message = this.presenceMessage();
    for (const [ws] of this.sessions) ws.send(message);
  }

  // A batch of changes from a client, built on revision `base`. The room wins: a change to something
  // someone else's later revision touched is refused. (A client's own earlier batches don't count,
  // since it has not necessarily heard about them yet.) What is accepted becomes the next revision and
  // goes to the others; the sender is told the revision, and sent the room's version of whatever was
  // refused, so it settles on the same map.
  receive(ws, message) {
    const session = this.sessions.get(ws);
    const known = this.covers(message.base);
    const touched = this.touchedSince(message.base, session.cid);
    const accepted = [];
    const refused = { ids: new Set(), order: false, name: false };
    for (const c of message.changes) {
      const conflict =
        !known || (c.t === 'order' ? touched.order : c.t === 'name' ? touched.name : touched.ids.has(c.id));
      if (!conflict) accepted.push(c);
      else if (c.t === 'order') refused.order = true;
      else if (c.t === 'name') refused.name = true;
      else refused.ids.add(c.id);
    }
    if (accepted.length) {
      for (const id of this.applyChanges(accepted)) {
        accepted.splice(
          accepted.findIndex((c) => c.t === 'set' && c.id === id),
          1,
        );
        refused.ids.add(id); // didn't fit: the sender is told what the room has instead
      }
    }
    if (accepted.length) {
      this.rev++;
      this.log.push({
        rev: this.rev,
        cid: session.cid,
        by: session.player,
        at: Date.now(),
        ids: accepted.filter((c) => c.t === 'set' || c.t === 'del').map((c) => c.id),
        order: accepted.some((c) => c.t === 'order'),
        name: accepted.some((c) => c.t === 'name'),
      });
      this.logWrites.add(this.rev);
      while (this.log.length > LOG_LIMIT) this.logDeletes.add(this.log.shift().rev);
      const forward = `{"type":"changes","rev":${this.rev},"changes":[${accepted.map(wire).join(',')}]}`;
      for (const [other] of this.sessions) if (other !== ws) other.send(forward);
    }
    const fix = this.currentAs(refused.ids, refused.order, refused.name).join(',');
    ws.send(`{"type":"ack","epoch":"${this.epoch}","rev":${this.rev},"fix":[${fix}]}`);
    return accepted.length > 0;
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
    for (const id of this.imageWrites) writes.push([`img:${id}`, this.images.get(id)]);
    for (const rev of this.logWrites) {
      const entry = this.log.find((e) => e.rev === rev);
      if (entry) writes.push([`log:${rev}`, entry]);
    }
    for (const rev of this.logDeletes) deletes.push(`log:${rev}`);
    if (this.orderDirty) writes.push(['order', [...this.elements.keys()]]);
    if (this.metaDirty) writes.push(['meta', { name: this.name, epoch: this.epoch, rev: this.rev }]);
    this.dirty = new Set();
    this.imageWrites = new Set();
    this.logWrites = new Set();
    this.logDeletes = new Set();
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
    this.epoch = '';
    this.rev = 0;
    this.log = [];
    this.images.clear();
    this.imagesTotal = 0;
    this.imageWrites = new Set();
    this.dirty = new Set();
    this.logWrites = new Set();
    this.logDeletes = new Set();
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

    ws.addEventListener('message', (evt) => {
      const message = parseMessage(evt.data);
      if (!message) return;
      if (message.type === 'hello') {
        const arrived = !this.sessions.has(ws);
        this.sessions.set(ws, { cid: message.cid, player: message.player });
        this.hello(ws, message);
        if (arrived) this.sendPresence();
        // A visit keeps the room another week.
        if (this.initialized) this.state.storage.setAlarm(Date.now() + RETENTION_MS);
        return;
      }
      if (!this.sessions.has(ws)) return; // nothing is taken from a client that hasn't said hello
      if (message.type === 'rename') {
        const session = this.sessions.get(ws);
        session.player = { ...session.player, name: message.name };
        this.sendPresence();
        return;
      }
      if (message.type === 'getimages') {
        for (const id of message.ids) {
          const data = this.images.get(id);
          if (data) ws.send(JSON.stringify({ type: 'image', id, data }));
        }
        return;
      }
      if (message.type === 'image') {
        if (!this.addImage(message.id, message.data)) return;
        this.imageWrites.add(message.id);
      } else if (message.type === 'doc') {
        if (this.initialized) {
          ws.send(this.documentMessage()); // too late to give the room a map: here is its map
          return;
        }
        this.seed(message);
        ws.send(`{"type":"ack","epoch":"${this.epoch}","rev":0,"fix":[]}`);
      } else if (!this.receive(ws, message)) {
        return; // nothing was accepted, so nothing to save
      }
      this.saveTimer ??= setTimeout(() => this.save(), SAVE_DELAY_MS);
    });

    const leave = () => {
      if (this.sessions.delete(ws)) this.sendPresence();
      if (!this.sessions.size && this.saveTimer) this.save(); // the last one out: keep what they left
    };
    ws.addEventListener('close', leave);
    ws.addEventListener('error', leave);
  }
}

// partysocket's default URL shape is /parties/<party-name>/<room-id>
// (party-name defaults to "main") — route purely on the trailing room id. The cursors socket
// (see cursors.js) is at /cursors/<room-id>, and goes to its own Durable Object.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const cursors = pathname.match(/^\/cursors\/([^/]+)/);
    if (cursors) return env.CURSORS.get(env.CURSORS.idFromName(cursors[1])).fetch(request);
    const match = pathname.match(/^\/parties\/[^/]+\/([^/]+)/);
    if (!match) return new Response('Not found', { status: 404 });
    const [, roomId] = match;
    const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
    return room.fetch(request);
  },
};
