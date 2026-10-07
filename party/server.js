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
// A room is a *table*, and holds several maps (the floors of a building the players move between; at most
// MAX_TABLE_MAPS). One of them is the table's current map, which everyone sees and edits: everything above is
// about that map, and `this.elements`, `this.name` and `this.total` are its. The others are parked in `this.maps`.
// Moving the table is switching which one is current (`goto`), or bringing a new one (`addmap`): every client is
// sent the map it moves to whole (`switch`), and a switch is a revision of its own, a barrier in the log that a
// client which was away across it is not caught up over (it is sent the whole map). A batch of changes says
// which map it was built on (`map`) and is dropped if the table has moved on since.
//
// Token pictures are not part of the map: a token holds the id of one, and each picture is kept once
// (`img:<id>`), sent by a client when it first uses it and handed to any client that asks for it.
// First one wins: a picture's id is made from its content, so it never needs to change.
//
// The maps are kept in the object's storage (one row per element, `el:<map>:<id>`, so an edit writes one row,
// not the whole map; switching writes only `meta`), so someone opening the link after everyone has left finds it as it was. A room is
// deleted a week after its last visit (an alarm), so abandoned rooms don't fill the free plan's
// storage. Until a room has been written to it is "fresh", and the first client to connect gives it
// its map (see src/collab/collab.ts).
//
// Connections use the WebSocket Hibernation API: the object is billed for time only while it is working, not
// for as long as a table is open, and Cloudflare may drop it from memory between messages (and load it
// again, from storage, when the next one comes). So nothing about a connection lives only in memory: who it
// is is kept with the socket itself (`serializeAttachment`) and read back when needed (`sessions()`).
// Unsaved edits can't be lost this way, because an object with a timer waiting is not dropped.
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

const CURSORS_OFF_CODE = 4503; // the same as in src/collab/cursors.ts
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
const MAX_IMAGE_LENGTH = 800_000; // the same raster-only check as src/core/image-data.ts
const MAX_IMAGES = 100;
const MAX_IMAGES_TOTAL_LENGTH = 6_000_000; // a few pictures on the map, and every token's
const MAX_IMAGES_PER_REQUEST = 50;
const MAX_PLAYERS_LISTED = 50; // the count is always the true one; only the list is cut
const MAX_TABLE_MAPS = 10; // maps a table can hold; every wake of the room reads them all from storage
const MAX_ROOM_TOTAL_LENGTH = 3_000_000; // all the maps' elements together (one map is at most MAX_TOTAL_LENGTH)

// Kept in step by hand with src/collab/changes.ts, which this file can't import.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TYPES = ['rect', 'wall', 'token', 'label', 'background'];

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
//   { type: 'doc', map, name, elements }  a map to give a fresh room (`map` is its id)
//   { type: 'addmap', map, name, elements }  a map for the table to hold, which the table moves to (if `map`
//        is already at the table, it just moves there). A table that is full (MAX_TABLE_MAPS maps, or
//        MAX_ROOM_TOTAL_LENGTH between them) drops its oldest maps, other than the one it is on, to make room
//   { type: 'goto', map }                 moves the table to a map it holds
//   { type: 'dropmap', map }              takes a map the table holds, but isn't on, away
//   { type: 'changes', base, map, changes }  changes made on top of revision `base`, on the map `map`
//   { type: 'rename', name }              the player's new name (a client that has said hello)
//   { type: 'image', id, data }           a token picture, which the room keeps if it hasn't got it
//   { type: 'getimages', ids }            asks for pictures, each answered with an `image` message
// and the room tells everyone `{ type: 'presence', count, players: [{ id, name }] }` when someone arrives
// or leaves, `{ type: 'switch', ...the map }` when the table moves, `{ type: 'maps', current, maps }` when the
// list of maps changes without that.
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
  if (data.type === 'goto' || data.type === 'dropmap') {
    return isId(data.map) ? { type: data.type, map: data.map } : null;
  }
  if (data.type === 'doc' || data.type === 'addmap') {
    if (!Array.isArray(data.elements) || data.elements.length > MAX_ELEMENTS) return null;
    const name = data.name ?? '';
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return null;
    const map = data.map;
    if (!isId(map)) return null;
    const sets = data.elements.map((el) => [el?.id, elementJson(el)]);
    return sets.some(([, json]) => json === null) ? null : { type: data.type, map, name, sets };
  }
  if (data.type !== 'changes' || !isRev(data.base) || !Array.isArray(data.changes)) return null;
  if (!isId(data.map)) return null;
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
  return { type: 'changes', base: data.base, map: data.map, changes };
}

// A change as the text that goes over the wire.
const wire = (c) => (c.t === 'set' ? `{"t":"set","el":${c.json}}` : JSON.stringify(c));

export class InkstoneRoom {
  constructor(state) {
    this.state = state; // Cloudflare's: storage, and the sockets (getWebSockets)
    this.elements = new Map(); // the current map: id -> the element's JSON text; its order is the map's order
    this.total = 0; // the length of all the JSON texts
    this.name = '';
    this.current = ''; // the id of the current map
    this.maps = new Map(); // the others the table holds: id -> { name, elements, total }
    this.mapOrder = []; // every map's id, in the order they were added
    this.initialized = false; // false until a client has given the room its map
    this.epoch = ''; // names this life of the room, so a client can tell if it was deleted and remade
    this.rev = 0;
    this.log = []; // { rev, cid, by: { id, name }, at, ids, order, name }, the last LOG_LIMIT
    this.images = new Map(); // id -> the picture's data URL
    this.imagesTotal = 0;
    this.imageWrites = new Set(); // picture ids to write at the next save
    this.dirty = new Set(); // `<map>:<id>` of elements to write (or delete) at the next save
    this.logWrites = new Set(); // revisions to write
    this.logDeletes = new Set(); // revisions to delete
    this.orderDirty = new Set(); // maps whose order is to be written
    this.orderDeletes = new Set(); // maps whose order is to be deleted
    this.metaDirty = false;
    this.saveTimer = null;
    this.ready = state.blockConcurrencyWhile(() => this.load());
  }

  async load() {
    const stored = await this.state.storage.list();
    const meta = stored.get('meta');
    const listed = Array.isArray(meta?.maps) ? meta.maps.filter((m) => isObject(m) && isId(m.id)) : [];
    if (isId(meta?.current) && listed.some((m) => m.id === meta.current)) {
      this.initialized = true;
      this.epoch = meta.epoch ?? '';
      this.rev = meta.rev ?? 0;
      this.current = meta.current;
      this.mapOrder = listed.map((m) => m.id);
      const targets = new Map();
      for (const { id, name } of listed) {
        const target = id === this.current ? this : { name: '', elements: new Map(), total: 0 };
        target.name = typeof name === 'string' ? name : '';
        for (const elId of stored.get(`order:${id}`) ?? [])
          this.keep(elId, stored.get(`el:${id}:${elId}`), target);
        targets.set(id, target);
        if (id !== this.current) this.maps.set(id, target);
      }
      for (const [key, json] of stored) {
        if (!key.startsWith('el:')) continue;
        const at = key.indexOf(':', 3);
        const target = at < 0 ? undefined : targets.get(key.slice(3, at));
        if (target) this.keep(key.slice(at + 1), json, target);
      }
    }
    for (const [key, data] of stored) {
      if (key.startsWith('img:') && isImageData(data)) this.addImage(key.slice(4), data);
    }
    this.log = [...stored]
      .filter(([key]) => key.startsWith('log:'))
      .map(([, entry]) => entry)
      .sort((a, b) => a.rev - b.rev);
  }

  // Puts an element in a map (the current one unless told otherwise; a new one goes last, an old one keeps its
  // place); false if it doesn't fit.
  keep(id, json, map = this) {
    if (typeof json !== 'string') return false;
    const old = map.elements.get(id);
    if (old === undefined && map.elements.size >= MAX_ELEMENTS) return false;
    if (map.total - (old?.length ?? 0) + json.length > MAX_TOTAL_LENGTH) return false;
    map.total += json.length - (old?.length ?? 0);
    map.elements.set(id, json);
    return true;
  }

  // The length of every map's elements together.
  roomTotal() {
    let total = this.total;
    for (const map of this.maps.values()) total += map.total;
    return total;
  }

  // The element `id` of the map `mapId` as it is now, if there is one.
  jsonOf(mapId, id) {
    return (mapId === this.current ? this.elements : this.maps.get(mapId)?.elements)?.get(id);
  }

  // Every map, in the order they were added, as { id, name }.
  mapList() {
    return this.mapOrder.map((id) => ({
      id,
      name: id === this.current ? this.name : (this.maps.get(id)?.name ?? ''),
    }));
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
    this.metaDirty = true;
    this.current = message.map;
    this.mapOrder = [message.map];
    this.maps.clear();
    this.elements.clear();
    this.total = 0;
    for (const [id, json] of message.sets) this.keep(id, json);
    this.name = message.name;
    this.dirty = new Set([...this.elements.keys()].map((id) => `${this.current}:${id}`));
    this.orderDirty = new Set([this.current]);
    this.orderDeletes = new Set();
  }

  // Applies changes already checked for conflicts: sets, then deletes, then the last order, then the
  // name, which is how changes.ts applies them. Returns the ids of sets that didn't fit.
  applyChanges(changes) {
    this.metaDirty = true;
    this.orderDirty.add(this.current); // cheap to rewrite, and sets and deletes change it anyway
    const failed = [];
    for (const c of changes) {
      if (c.t !== 'set') continue;
      if (this.keep(c.id, c.json)) this.dirty.add(`${this.current}:${c.id}`);
      else failed.push(c.id);
    }
    for (const c of changes) {
      if (c.t === 'del' && this.elements.has(c.id)) {
        this.total -= this.elements.get(c.id).length;
        this.elements.delete(c.id);
        this.dirty.add(`${this.current}:${c.id}`);
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
    return this.mapMessage('doc', `"fresh":${!this.initialized},`);
  }

  // The current map whole, as a `doc` (to a client with nothing to be caught up from) or a `switch` (to
  // everyone, when the table moves), with the list of maps the table holds.
  mapMessage(type, fresh = '') {
    const elements = [...this.elements.values()].join(',');
    return `{"type":"${type}",${fresh}"epoch":"${this.epoch}","rev":${this.rev},"name":${JSON.stringify(this.name)},"map":"${this.current}","maps":${JSON.stringify(this.mapList())},"elements":[${elements}]}`;
  }

  // Makes a map the table holds, other than the current one, the current one (which is parked).
  swapTo(id) {
    const target = this.maps.get(id);
    if (!target) return false;
    this.maps.set(this.current, { name: this.name, elements: this.elements, total: this.total });
    this.maps.delete(id);
    this.current = id;
    this.name = target.name;
    this.elements = target.elements;
    this.total = target.total;
    this.metaDirty = true;
    return true;
  }

  // The table has moved: a revision of its own (a barrier in the log), and everyone is sent the map it is on,
  switched(session) {
    this.rev++;
    this.log.push({
      rev: this.rev,
      cid: session.cid,
      by: session.player,
      at: Date.now(),
      ids: [],
      order: false,
      name: false,
      switch: true,
    });
    this.logWrites.add(this.rev);
    while (this.log.length > LOG_LIMIT) this.logDeletes.add(this.log.shift().rev);
    this.metaDirty = true;
    const message = this.mapMessage('switch');
    for (const [other] of this.sessions()) other.send(message);
  }

  // Moves the table to a map it holds. False if it is the current one, or isn't held.
  goto(session, id) {
    if (id === this.current || !this.swapTo(id)) return false;
    this.switched(session);
    return true;
  }

  // Takes a map for the table to hold, and moves the table to it. A map it already holds is just moved to.
  // A table that is full lets its oldest maps go, other than the one it is on, to make room for the new one
  // (a long game keeps moving on), without a word to anyone. Any map that got here fits: parseMessage
  // already holds it to MAX_ELEMENTS elements and MAX_TOTAL_LENGTH in all.
  addMap(session, message) {
    const { map, name, sets } = message;
    if (this.mapOrder.includes(map)) return this.goto(session, map);
    const target = { name, elements: new Map(), total: 0 };
    for (const [id, json] of sets) this.keep(id, json, target);
    const full = () =>
      this.mapOrder.length >= MAX_TABLE_MAPS || this.roomTotal() + target.total > MAX_ROOM_TOTAL_LENGTH;
    while (full()) {
      const oldest = this.mapOrder.find((id) => id !== this.current);
      if (oldest === undefined) break;
      this.forget(oldest);
    }
    this.maps.set(map, target);
    this.mapOrder.push(map);
    for (const id of target.elements.keys()) this.dirty.add(`${map}:${id}`);
    this.orderDirty.add(map);
    this.orderDeletes.delete(map);
    this.swapTo(map);
    this.switched(session);
    return true;
  }

  // Forgets a map the table holds but isn't on: its rows are deleted at the next save.
  forget(id) {
    const target = this.maps.get(id);
    for (const elId of target.elements.keys()) this.dirty.add(`${id}:${elId}`); // gone, so they are deleted
    this.orderDirty.delete(id);
    this.orderDeletes.add(id);
    this.maps.delete(id);
    this.mapOrder = this.mapOrder.filter((m) => m !== id);
    this.metaDirty = true;
  }

  // Takes a map the table holds, but isn't on, away for good. False if it is the current one, or isn't held.
  dropMap(id) {
    if (!this.maps.has(id)) return false;
    this.forget(id);
    const message = JSON.stringify({ type: 'maps', current: this.current, maps: this.mapList() });
    for (const [ws] of this.sessions()) ws.send(message);
    return true;
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

  // Who a client is ({ cid, player }), once it has said hello; null before that, and after it has left.
  // Kept with the socket, so it survives the object being dropped from memory.
  sessionOf(ws) {
    return ws.deserializeAttachment() ?? null;
  }

  // Everyone who has said hello, as [socket, session].
  sessions() {
    return this.state.getWebSockets().flatMap((ws) => {
      const session = this.sessionOf(ws);
      return session ? [[ws, session]] : [];
    });
  }

  hello(ws, { epoch, since }) {
    const caughtUp = this.initialized && epoch === this.epoch && since !== undefined && since <= this.rev;
    const switched = since !== undefined && this.log.some((entry) => entry.switch && entry.rev > since);
    if (!caughtUp || !this.covers(since) || switched) {
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
    for (const [, { player }] of this.sessions())
      players.set(player.id, { id: player.id, name: player.name });
    return JSON.stringify({
      type: 'presence',
      count: players.size,
      players: [...players.values()].slice(0, MAX_PLAYERS_LISTED),
    });
  }

  sendPresence() {
    const message = this.presenceMessage();
    for (const [ws] of this.sessions()) ws.send(message);
  }

  // A batch of changes from a client, built on revision `base`. The room wins: a change to something
  // someone else's later revision touched is refused. (A client's own earlier batches don't count,
  // since it has not necessarily heard about them yet.) What is accepted becomes the next revision and
  // goes to the others; the sender is told the revision, and sent the room's version of whatever was
  // refused, so it settles on the same map.
  receive(ws, message) {
    if (message.map !== undefined && message.map !== this.current) {
      // Built on a map the table has left: the switch is already on its way to this client.
      ws.send(`{"type":"ack","epoch":"${this.epoch}","rev":${this.rev},"fix":[]}`);
      return false;
    }
    const session = this.sessionOf(ws);
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
      for (const [other] of this.sessions()) if (other !== ws) other.send(forward);
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
    for (const key of this.dirty) {
      const at = key.indexOf(':');
      const json = this.jsonOf(key.slice(0, at), key.slice(at + 1));
      if (json === undefined) deletes.push(`el:${key}`);
      else writes.push([`el:${key}`, json]);
    }
    for (const id of this.imageWrites) writes.push([`img:${id}`, this.images.get(id)]);
    for (const rev of this.logWrites) {
      const entry = this.log.find((e) => e.rev === rev);
      if (entry) writes.push([`log:${rev}`, entry]);
    }
    for (const rev of this.logDeletes) deletes.push(`log:${rev}`);
    for (const id of this.orderDirty) {
      const map = id === this.current ? this : this.maps.get(id);
      if (map) writes.push([`order:${id}`, [...map.elements.keys()]]);
    }
    for (const id of this.orderDeletes) deletes.push(`order:${id}`);
    if (this.metaDirty) {
      writes.push([
        'meta',
        { epoch: this.epoch, rev: this.rev, current: this.current, maps: this.mapList() },
      ]);
    }
    this.dirty = new Set();
    this.imageWrites = new Set();
    this.logWrites = new Set();
    this.logDeletes = new Set();
    this.orderDirty = new Set();
    this.orderDeletes = new Set();
    this.metaDirty = false;
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
    this.current = '';
    this.maps.clear();
    this.mapOrder = [];
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
    this.orderDirty = new Set();
    this.orderDeletes = new Set();
    this.metaDirty = false;
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

  // Takes a new socket. Its messages and its end arrive at webSocketMessage / webSocketClose below,
  // by Cloudflare's own names, whether or not the object was dropped from memory in between.
  handleSession(ws) {
    this.state.acceptWebSocket(ws);
  }

  webSocketMessage(ws, data) {
    const message = parseMessage(data);
    if (!message) return;
    if (message.type === 'hello') {
      const arrived = !this.sessionOf(ws);
      ws.serializeAttachment({ cid: message.cid, player: message.player });
      this.hello(ws, message);
      if (arrived) this.sendPresence();
      // A visit keeps the room another week.
      if (this.initialized) this.state.storage.setAlarm(Date.now() + RETENTION_MS);
      return;
    }
    const session = this.sessionOf(ws);
    if (!session) return; // nothing is taken from a client that hasn't said hello
    if (message.type === 'rename') {
      ws.serializeAttachment({ ...session, player: { ...session.player, name: message.name } });
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
    } else if (message.type === 'addmap') {
      if (!this.addMap(session, message)) return;
    } else if (message.type === 'goto') {
      if (!this.goto(session, message.map)) return;
    } else if (message.type === 'dropmap') {
      if (!this.dropMap(message.map)) return;
    } else if (!this.receive(ws, message)) {
      return; // nothing was accepted, so nothing to save
    }
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_DELAY_MS);
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
    if (!this.sessionOf(ws)) return; // it never said hello, or has already gone
    ws.serializeAttachment(null); // so it no longer counts as here, though it may still be listed
    this.sendPresence();
    if (!this.sessions().length && this.saveTimer) this.save(); // the last one out: keep what they left
  }
}

// partysocket's default URL shape is /parties/<party-name>/<room-id>
// (party-name defaults to "main") — route purely on the trailing room id. The cursors socket
// (see cursors.js) is at /cursors/<room-id>, and goes to its own Durable Object.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const cursors = pathname.match(/^\/cursors\/([^/]+)/);
    if (cursors) {
      // The first thing to switch off when the free plan's daily limits run low (set CURSORS_OFF to 1 in the
      // Worker's variables): the socket is accepted and closed with this code, which tells the client to
      // stop trying (see src/collab/cursors.ts), without waking a Durable Object.
      if (env.CURSORS_OFF === '1' && request.headers.get('Upgrade') === 'websocket') {
        const [client, server] = Object.values(new WebSocketPair());
        server.accept();
        server.close(CURSORS_OFF_CODE, 'Cursors are off');
        return new Response(null, { status: 101, webSocket: client });
      }
      return env.CURSORS.get(env.CURSORS.idFromName(cursors[1])).fetch(request);
    }
    const match = pathname.match(/^\/parties\/[^/]+\/([^/]+)/);
    if (!match) return new Response('Not found', { status: 404 });
    const [, roomId] = match;
    const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
    return room.fetch(request);
  },
};
