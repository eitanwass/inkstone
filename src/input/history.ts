// ── Undo/redo + board persistence ───────────────────────────────
// Whole-document snapshots rather than per-action commands: state.elements
// is small (a hand-drawn map), so cloning it on every mutation is cheap and
// — unlike a command/diff stack — automatically correct for every action
// (move, resize, rotate, erase, reorder, ...) without bespoke undo logic
// per action type.

import { applyChanges, type Change, ensureIds } from '../collab/changes';
import { byId } from '../core/dom';
import { isImageData } from '../core/image-data';
import { state } from '../core/state';
import { storageGet, storageRemove, storageSet } from '../core/storage';
import type { BoardElement } from '../core/types';
import { parseElements } from '../core/validate';
import { drawMain } from '../draw/render';
import { isInteractive } from '../elements/layer';
import { addImage } from '../elements/token-image';
import { normalizeMapName } from '../ui/map-name-text';
import { showToast } from '../ui/toast';

const history: { stack: BoardElement[][]; index: number } = { stack: [], index: -1 };
const HISTORY_LIMIT = 100;

// Inversion of control, not a direct import: collab.js (which broadcasts
// state to other connected clients) sits above history.js in the module
// chain, so history.js can't import it without creating a cycle. Instead
// collab.js registers itself here and gets called after every change that
// should propagate to other players.
let historyListener: (() => void) | null = null;
export function setHistoryListener(fn: () => void): void {
  historyListener = fn;
}

// Persistence piggybacks on the same chokepoint: pushHistory()/undo()/redo()
// all call persistBoard(), which writes state.elements to localStorage. Only
// the board content persists across a reload — the undo/redo stack itself
// does not, so a fresh load always starts with a single history baseline.
const STORAGE_KEY = 'inkstone-board';
const NAME_STORAGE_KEY = 'inkstone-map-name';

// Saving is a convenience, not a requirement, so a failed write never breaks
// the app — but the first failure per page load tells the player, since their
// work won't survive a reload.
let warnedSaveFailed = false;

// The save indicator beside the Live pill: a spinner while saving, a check once saved, an X if
// the browser refused. A save to localStorage is instant, so a success shows the spinner for a
// moment first (restarted by each further save), or an edit would give no sign of being saved.
const SAVING_MS = 600;
const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', failed: 'Not saved' };
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function setSaveState(state: keyof typeof SAVE_LABELS): void {
  const status = byId('save-status');
  status.dataset.state = state;
  status.setAttribute('aria-label', SAVE_LABELS[state]);
  status.title = SAVE_LABELS[state];
}

function showSaveStatus(saved: boolean): void {
  clearTimeout(saveTimer);
  if (!saved) {
    setSaveState('failed');
    return;
  }
  setSaveState('saving');
  saveTimer = setTimeout(() => setSaveState('saved'), SAVING_MS);
}

export function persistBoard(): void {
  const saved = storageSet(STORAGE_KEY, JSON.stringify(state.elements));
  showSaveStatus(saved);
  if (saved || warnedSaveFailed) return;
  warnedSaveFailed = true;
  showToast(
    "Your map can't be saved in this browser (storage is full or blocked), so it won't survive a reload.",
  );
}

export function loadPersistedBoard(): BoardElement[] | null {
  const saved = storageGet(STORAGE_KEY);
  if (!saved) return null;
  try {
    const raw = JSON.parse(saved);
    // A board saved when pictures were kept inside the token: move them to the image store.
    if (Array.isArray(raw)) {
      for (const el of raw) if (el?.type === 'token' && isImageData(el.image)) el.image = addImage(el.image);
    }
    return parseElements(raw);
  } catch {
    return null;
  }
}

// The map's name is saved separately from the elements: it isn't part of the
// undo history (renaming and undoing don't interact), so it has its own
// chokepoint, called when a rename is committed or one arrives from someone else.
export function persistMapName(): void {
  if (!state.mapName) {
    storageRemove(NAME_STORAGE_KEY);
    showSaveStatus(true);
    return;
  }
  showSaveStatus(storageSet(NAME_STORAGE_KEY, state.mapName));
}

export function loadPersistedMapName(): string {
  return normalizeMapName(storageGet(NAME_STORAGE_KEY));
}

// Tells other players what changed without recording an undo step. Used when only the name
// changed: the change that goes out is just the new name, never the map.
export function broadcastDocument(): void {
  if (historyListener) historyListener();
}

export function pushHistory() {
  ensureIds(state.elements);
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(structuredClone(state.elements));
  if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
  persistBoard();
  if (historyListener) historyListener();
}

// Jumps to another snapshot on the stack, then persists and broadcasts it.
function restoreSnapshot(index: number, toastMessage: string): void {
  history.index = index;
  state.elements = structuredClone(history.stack[index]);
  state.selected = [];
  drawMain();
  updateUndoRedoButtons();
  persistBoard();
  showToast(toastMessage);
  if (historyListener) historyListener();
}

export function undo() {
  if (history.index > 0) restoreSnapshot(history.index - 1, 'Undo');
}

// A toast for something destructive that has just been done, with a button that takes it back.
export function showUndoToast(message: string): void {
  showToast(message, { label: 'Undo', run: undo });
}

export function redo() {
  if (history.index < history.stack.length - 1) restoreSnapshot(history.index + 1, 'Redo');
}

// What arrives from another connected client (collab.ts) never goes onto the undo stack as a step:
// undo/redo stays about *your own* edits, so undoing right after a remote change doesn't silently
// revert something you didn't do.

// The whole map, when connecting to a room: it replaces this one, and is the new starting point for
// undo (going back to a map from before joining would send the room a map it never had).
export function applyRemoteDocument(name: string, elements: BoardElement[]): void {
  startMap(name, elements);
}

// Puts a different map on the board as its own beginning: no undo step to go back to the one before (it is
// kept elsewhere, see ui/maps.ts) and nothing sent to a session.
export function startMap(name: string, elements: BoardElement[]): void {
  ensureIds(elements);
  state.elements = elements;
  state.selected = [];
  state.mapName = name;
  persistMapName();
  history.stack = [structuredClone(elements)];
  history.index = 0;
  updateUndoRedoButtons();
  drawMain();
  persistBoard();
}

// What someone else changed. It is applied to the map you are looking at and to every step of your
// undo history, so undoing your own edit later keeps their work instead of putting the old map back.
// Whatever you had selected stays selected, unless they deleted it.
export function applyRemoteChanges(changes: Change[]): void {
  ensureIds(state.elements);
  const selectedIds = state.selected.map((i) => state.elements[i]?.id);
  state.elements = applyChanges(state.elements, changes);
  state.selected = selectedIds.flatMap((id) => {
    const i = state.elements.findIndex((el) => el.id === id);
    return i < 0 || !isInteractive(state.elements[i]) ? [] : [i]; // locked by someone else: let go
  });
  history.stack = history.stack.map((snapshot) => applyChanges(snapshot, structuredClone(changes)));
  const rename = changes.findLast((c) => c.t === 'name');
  if (rename?.t === 'name') {
    state.mapName = rename.name;
    persistMapName();
  }
  drawMain();
  persistBoard();
}

export function updateUndoRedoButtons() {
  byId<HTMLButtonElement>('btn-undo').disabled = history.index <= 0;
  byId<HTMLButtonElement>('btn-redo').disabled = history.index >= history.stack.length - 1;
}

byId('btn-undo').addEventListener('click', undo);
byId('btn-redo').addEventListener('click', redo);
