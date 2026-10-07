// ── My Maps: keeping several maps and moving between them ──────
// The map on the board is the working copy, saved on every change as it always was (input/history.ts). The
// others are parked in this browser (core/maps.ts holds the index and the rules): moving to another map parks
// the one on the board, with a small picture of it (map-thumbnail.ts), and brings the other one out. A map
// with no name and nothing on it is not parked: it is just let go. Nothing is ever replaced: a map made from a
// library sample or a new one is a map of its own, and the one you were on is still in My Maps.
//
// While the board is in a live session, moving to another map leaves the session (after asking): until a
// map and a session are told apart (a table that moves between maps), the two can't be on screen together
// without the session's map being swapped for everyone in it.

import { isShared, leaveSession } from '../collab/collab';
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

// ── Moving between maps ───────────────────────────────────────
// Asks first when the board is in a live session, since moving on leaves it.
function leavingSession(then: () => void): void {
  if (!isShared()) {
    then();
    return;
  }
  showConfirm(
    'This map is shared live. Moving to another map leaves the session. Leave it?',
    () => {
      leaveSession();
      then();
    },
    'Leave session',
  );
}

// Parks the map on the board (unless it is blank), makes `id` the one on the board and puts `elements` on it. False,
// with a toast, if it can't be kept: then nothing has changed.
function putOnBoard(index: MapIndex, id: string, name: string, elements: BoardElement[]): boolean {
  let next: MapIndex = withoutEntry({ ...index, current: id }, id);
  let parkedId: string | null = null;
  if (!isBlankMap(state.mapName, state.elements)) {
    if (index.maps.length >= MAX_MAPS && !index.maps.some((m) => m.id === id)) {
      showToast(`You can keep up to ${MAX_MAPS} maps. Delete one first.`);
      return false;
    }
    const entry: MapEntry = { id: index.current, name: state.mapName, updated: Date.now() };
    const thumbnail = makeThumbnail();
    if (thumbnail) entry.thumbnail = thumbnail;
    if (!storageSet(slotKey(entry.id), JSON.stringify(state.elements))) {
      showToast("There isn't room in this browser to keep the map you are on. Delete a map first.");
      return false;
    }
    parkedId = entry.id;
    next = withEntry(next, entry);
  }
  if (!saveIndex(next)) {
    if (parkedId) storageRemove(slotKey(parkedId));
    showToast("There isn't room in this browser to keep your maps. Delete a map first.");
    return false;
  }
  storageRemove(slotKey(id)); // it is the board's now, saved there on every change
  setTool('select'); // lets go of anything half done
  startMap(name, elements);
  refreshMapName();
  fitMapToScreen();
  return true;
}

// A new, empty map. (The map on the board, if it is blank already, is the new map.)
export function newMap(): void {
  leavingSession(() => {
    if (isBlankMap(state.mapName, state.elements)) return;
    if (putOnBoard(loadIndex(), newMapId(), '', [])) showToast('New map');
  });
}

// A parked map, on the board.
export function openSavedMap(id: string): void {
  leavingSession(() => {
    const index = loadIndex();
    if (id === index.current) return;
    const entry = index.maps.find((m) => m.id === id);
    const elements = entry ? readSlot(id) : null;
    if (!entry || !elements) {
      if (entry) saveIndex(withoutEntry(index, id));
      showToast("Couldn't open that map. It is no longer kept in this browser.");
      return;
    }
    if (putOnBoard(index, id, entry.name, elements)) showToast(`Opened "${entry.name || 'Untitled map'}"`);
  });
}

// A map made elsewhere (a library sample), as a map of its own.
export function openAsNewMap(map: MapFile, message: string): void {
  leavingSession(() => {
    for (const [id, data] of Object.entries(map.images)) receiveImage(id, data);
    if (putOnBoard(loadIndex(), newMapId(), normalizeMapName(map.name), map.elements)) showToast(message);
  });
}

// Forgets a map for good: a parked one is deleted, the one on the board gives its place to the map put away
// most recently (or to an empty one).
export function deleteMap(id: string): void {
  const index = loadIndex();
  if (id !== index.current) {
    storageRemove(slotKey(id));
    saveIndex(withoutEntry(index, id));
    return;
  }
  leavingSession(() => {
    const next = byRecent(index.maps).find((m) => readSlot(m.id));
    const elements = next ? (readSlot(next.id) ?? []) : [];
    const rest = next ? withoutEntry(index, next.id) : index;
    saveIndex({ ...rest, current: next?.id ?? newMapId() });
    if (next) storageRemove(slotKey(next.id));
    setTool('select');
    startMap(next?.name ?? '', elements);
    refreshMapName();
    fitMapToScreen();
  });
}
