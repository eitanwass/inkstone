// ── My Maps: keeping several maps and moving between them ──────
// The map on the board is the working copy, saved on every change as it always was (input/history.ts). The
// others are parked in this browser (core/maps.ts holds the index and the rules): moving to another map parks
// the one on the board, with a small picture of it (map-thumbnail.ts), and brings the other one out. A map
// with no name and nothing on it is not parked: it is just let go. Nothing is ever replaced: a map made from a
// library sample or a new one is a map of its own, and the one you were on is still in My Maps.
//
// A session is a table, and a map is where the table is. A table holds its own maps (the floors of a building),
// kept by the room, and is on one of them: that is everyone's board. So at a table nothing here is parked or
// moved: choosing a map from My Maps, a sample or a new map *brings a copy to the table* (after asking), which
// moves everyone to it, and the one in My Maps stays where it is. Moving between the maps the table already
// holds is the table's own list (ui/table-maps.ts). Joining a table puts the map on your board away first
// (`beforeJoin`). collab.ts calls these as hooks (it sits below this file). Anyone at the table may bring a map
// or move it, until roles exist.

import { addTableMap, isShared, setTableHooks } from '../collab/collab';
import type { MapFile } from '../core/map-file';
import {
  byRecent,
  INDEX_KEY,
  isBlankMap,
  MAX_MAPS,
  type MapEntry,
  type MapIndex,
  newMapId,
  parseIndex,
  slotKey,
  withEntry,
  withoutEntry,
} from '../core/maps';
import { state } from '../core/state';
import { storageGet, storageRemove, storageSet } from '../core/storage';
import type { BoardElement } from '../core/types';
import { parseElements } from '../core/validate';
import { pictureOf, receiveImage, setImageKeepers } from '../elements/token-image';
import { fitMapToScreen } from '../input/controls';
import { startMap } from '../input/history';
import { setTool } from '../input/toolbar';
import { refreshMapName } from './map-name';
import { normalizeMapName } from './map-name-text';
import { makeThumbnail } from './map-thumbnail';
import { showConfirm } from './modal';
import { showToast } from './toast';

export type MyMap = MapEntry & { current: boolean };

const titleOf = (name: string): string => `"${name || 'Untitled map'}"`;

// ── What is kept ───────────────────────────────────────────────
function loadIndex(): MapIndex {
  try {
    const index = parseIndex(JSON.parse(storageGet(INDEX_KEY) ?? 'null'));
    if (index) return index;
  } catch {
    // Not JSON: a new index.
  }
  return { current: newMapId(), maps: [] };
}

const saveIndex = (index: MapIndex): boolean => storageSet(INDEX_KEY, JSON.stringify(index));

// A parked map's elements, or null if it isn't there (or isn't a map).
function readSlot(id: string): BoardElement[] | null {
  const text = storageGet(slotKey(id));
  if (text === null) return null;
  try {
    return parseElements(JSON.parse(text));
  } catch {
    return null;
  }
}

// The pictures the parked maps show, which the picture store must not let go of however old they are.
setImageKeepers(() => {
  const ids = new Set<string>();
  for (const { id } of loadIndex().maps) {
    for (const el of readSlot(id) ?? []) {
      const picture = pictureOf(el);
      if (picture) ids.add(picture);
    }
  }
  return ids;
});

// ── What is listed ─────────────────────────────────────────────
// Every map, the one on the board first (as it is now, with a picture made just now), then the parked ones,
// the most recently put away first.
export function listMaps(): MyMap[] {
  const index = loadIndex();
  const here: MyMap = {
    id: index.current,
    name: state.mapName,
    updated: Date.now(),
    thumbnail: makeThumbnail() ?? undefined,
    current: true,
  };
  return [here, ...byRecent(index.maps).map((m) => ({ ...m, current: false }))];
}

// Whether any map has been put away: if not, My Maps has only the one on the board.
export const hasParkedMaps = (): boolean => loadIndex().maps.length > 0;

// ── Putting a map away ─────────────────────────────────────────
// The map on the board (unless it is blank) as a parked one: its elements under their own key and its entry
// in `index`, which is returned, not saved; `key` is what was written (to take back if the index can't be
// kept). Null, with a toast, if it can't be kept: nothing has changed then. `canGrow` is whether the list may
// get one longer.
function park(index: MapIndex, canGrow: boolean): { index: MapIndex; key: string | null } | null {
  if (isBlankMap(state.mapName, state.elements)) return { index, key: null };
  if (!canGrow && index.maps.length >= MAX_MAPS) {
    showToast(`You can keep up to ${MAX_MAPS} maps. Delete one first.`);
    return null;
  }
  const entry: MapEntry = { id: index.current, name: state.mapName, updated: Date.now() };
  const thumbnail = makeThumbnail();
  if (thumbnail) entry.thumbnail = thumbnail;
  const key = slotKey(entry.id);
  if (!storageSet(key, JSON.stringify(state.elements))) {
    showToast("There isn't room in this browser to keep the map you are on. Delete a map first.");
    return null;
  }
  return { index: withEntry(index, entry), key };
}

// ── Moving between maps ───────────────────────────────────────
// Puts `elements` on the board as the map `id`, and the map that was there away (unless it is blank). False,
// with a toast, if it can't be kept: then nothing has changed.
function putOnBoard(index: MapIndex, id: string, name: string, elements: BoardElement[]): boolean {
  const parked = park(
    index,
    index.maps.some((m) => m.id === id),
  );
  if (!parked) return false;
  // The map that was on the board is parked under its own id; `id` is the board's now, so it is not parked.
  const next = withoutEntry({ ...parked.index, current: id }, id);
  if (!saveIndex(next)) {
    if (parked.key) storageRemove(parked.key);
    showToast("There isn't room in this browser to keep your maps. Delete a map first.");
    return false;
  }
  storageRemove(slotKey(id)); // it is the board's now, saved there on every change
  show(name, elements);
  return true;
}

// The board shows `name` and `elements`, as a fresh start (nothing to undo back to).
function show(name: string, elements: BoardElement[]): void {
  setTool('select'); // lets go of anything half done
  startMap(name, elements);
  refreshMapName();
  fitMapToScreen();
}

// At a table, a map from here is brought to it: a copy goes to the room, which keeps the table's maps, and
// everyone's board follows (the one in My Maps stays where it is). Asks first, since it is everyone's.
function bringToTable(id: string, name: string, elements: BoardElement[]): void {
  const what = elements.length || name ? titleOf(name) : 'a new, empty map';
  showConfirm(
    `Bring ${what} to the table? Everyone at the table will see it.`,
    () => void addTableMap({ id, name, elements }),
    'Bring to the table',
  );
}

// A new, empty map. (The map on the board, if it is blank already, is the new map.)
export function newMap(): void {
  if (isShared()) {
    bringToTable(newMapId(), '', []);
    return;
  }
  if (isBlankMap(state.mapName, state.elements)) return;
  if (putOnBoard(loadIndex(), newMapId(), '', [])) showToast('New map');
}

// A parked map, on the board (or brought to the table).
export function openSavedMap(id: string): void {
  const index = loadIndex();
  if (id === index.current) return;
  const entry = index.maps.find((m) => m.id === id);
  const elements = entry ? readSlot(id) : null;
  if (!entry || !elements) {
    if (entry) saveIndex(withoutEntry(index, id));
    showToast("Couldn't open that map. It is no longer kept in this browser.");
    return;
  }
  if (isShared()) {
    bringToTable(id, entry.name, elements);
    return;
  }
  if (putOnBoard(index, id, entry.name, elements)) showToast(`Opened ${titleOf(entry.name)}`);
}

// A map made elsewhere (a library sample), as a map of its own (or brought to the table).
export function openAsNewMap(map: MapFile, message: string): void {
  for (const [id, data] of Object.entries(map.images)) receiveImage(id, data);
  const name = normalizeMapName(map.name);
  if (isShared()) {
    bringToTable(newMapId(), name, map.elements);
    return;
  }
  if (putOnBoard(loadIndex(), newMapId(), name, map.elements)) showToast(message);
}

// Forgets a map for good: a parked one is deleted, the one on the board gives its place to the map put away
// most recently (or to an empty one). The one on the board at a table is the table's, not a map of yours to
// delete: leave the session, or take it off the table, first.
export function deleteMap(id: string): void {
  const index = loadIndex();
  if (id !== index.current) {
    storageRemove(slotKey(id));
    saveIndex(withoutEntry(index, id));
    return;
  }
  if (isShared()) {
    showToast('That map is at the table. Leave the session first, or take it off the table.');
    return;
  }
  const next = byRecent(index.maps).find((m) => readSlot(m.id));
  const elements = next ? (readSlot(next.id) ?? []) : [];
  const rest = next ? withoutEntry(index, next.id) : index;
  saveIndex({ ...rest, current: next?.id ?? newMapId() });
  if (next) storageRemove(slotKey(next.id));
  show(next?.name ?? '', elements);
}

// ── At a table ─────────────────────────────────────────────────
setTableHooks({
  // A room nobody has used is given the map on the board under the id it has in My Maps.
  mapId: () => loadIndex().current,

  // The board's map is the table's now (a room nobody had used took it).
  shared(session) {
    saveIndex({ ...loadIndex(), table: session });
  },

  // The table's map is about to take the board's place. Unless the board's map is already the table's (a
  // reload, a reconnect), it is put away first, so joining never costs a map.
  beforeJoin(session) {
    const index = loadIndex();
    if (index.table === session) return true;
    const name = state.mapName;
    const parked = park(index, false);
    if (!parked) return false;
    const next = { ...parked.index, current: parked.key ? newMapId() : index.current, table: session };
    if (!saveIndex(next)) {
      if (parked.key) storageRemove(parked.key);
      showToast("There isn't room in this browser to keep your maps. Delete a map first.");
      return false;
    }
    if (parked.key) showToast(`${titleOf(name)} was put away in My Maps`);
    return true;
  },

  // The table moved to another map, and it is on the board now (collab.ts put it there, as a fresh start).
  // What you had was the table's old map, not yours, so nothing is put away.
  switched() {
    setTool('select');
    refreshMapName();
    fitMapToScreen();
    showToast(`The table moved to ${titleOf(state.mapName)}`);
  },

  // The board left its table: it is a map of yours, at no table.
  left() {
    const { table, ...index } = loadIndex();
    if (table !== undefined) saveIndex(index);
  },
});
