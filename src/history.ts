// ── Undo/redo + board persistence ───────────────────────────────
// Whole-document snapshots rather than per-action commands: state.elements
// is small (a hand-drawn map), so cloning it on every mutation is cheap and
// — unlike a command/diff stack — automatically correct for every action
// (move, resize, rotate, erase, reorder, ...) without bespoke undo logic
// per action type.

import { byId } from './dom';
import { normalizeMapName } from './map-name-text';
import { drawMain } from './render';
import { state } from './state';
import { storageGet, storageRemove, storageSet } from './storage';
import { showToast } from './toast';
import type { BoardElement, BoardSnapshot } from './types';
import { parseElements } from './validate';

const history: { stack: BoardElement[][]; index: number } = { stack: [], index: -1 };
const HISTORY_LIMIT = 100;

// Inversion of control, not a direct import: collab.js (which broadcasts
// state to other connected clients) sits above history.js in the module
// chain, so history.js can't import it without creating a cycle. Instead
// collab.js registers itself here and gets called after every change that
// should propagate to peers.
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
// the app — but the first failure per page load tells the user, since their
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
    return parseElements(JSON.parse(saved));
  } catch {
    return null;
  }
}

// The map's name is saved separately from the elements: it isn't part of the
// undo history (renaming and undoing don't interact), so it has its own
// chokepoint, called when a rename is committed or one arrives from a peer.
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

// Sends the current document to collaborators without recording an undo step.
// Used when only the name changed: the relay remembers just the latest message
// to catch up whoever joins next, so a rename sends the whole snapshot (name
// plus the unchanged elements) and not a name-only message.
export function broadcastDocument(): void {
  if (historyListener) historyListener();
}

export function pushHistory() {
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

// Applied when a snapshot arrives from another connected client (collab.js).
// Deliberately bypasses history.stack — undo/redo stays about *your own*
// edits, not a peer's, so undoing right after a remote change doesn't
// silently revert something you didn't do. A snapshot with no name (an older
// client's) leaves the map's name alone.
export function applyRemoteSnapshot(snapshot: BoardSnapshot): void {
  state.elements = snapshot.elements;
  state.selected = [];
  if (snapshot.name !== undefined) {
    state.mapName = snapshot.name;
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
