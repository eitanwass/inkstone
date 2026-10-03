// ── Undo/redo + board persistence ───────────────────────────────
// Whole-document snapshots rather than per-action commands: state.elements
// is small (a hand-drawn map), so cloning it on every mutation is cheap and
// — unlike a command/diff stack — automatically correct for every action
// (move, resize, rotate, erase, reorder, ...) without bespoke undo logic
// per action type.

import { byId } from './dom';
import { drawMain } from './render';
import { state } from './state';
import { storageGet, storageSet } from './storage';
import { showToast } from './toast';
import type { BoardElement } from './types';
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

// Saving is a convenience, not a requirement, so a failed write never breaks
// the app — but the first failure per page load tells the user, since their
// work won't survive a reload.
let warnedSaveFailed = false;

export function persistBoard(): void {
  if (storageSet(STORAGE_KEY, JSON.stringify(state.elements)) || warnedSaveFailed) return;
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

export function redo() {
  if (history.index < history.stack.length - 1) restoreSnapshot(history.index + 1, 'Redo');
}

// Applied when a snapshot arrives from another connected client (collab.js).
// Deliberately bypasses history.stack — undo/redo stays about *your own*
// edits, not a peer's, so undoing right after a remote change doesn't
// silently revert something you didn't do.
export function applyRemoteSnapshot(elements: BoardElement[]): void {
  state.elements = elements;
  state.selected = [];
  drawMain();
  persistBoard();
}

export function updateUndoRedoButtons() {
  byId<HTMLButtonElement>('btn-undo').disabled = history.index <= 0;
  byId<HTMLButtonElement>('btn-redo').disabled = history.index >= history.stack.length - 1;
}

byId('btn-undo').addEventListener('click', undo);
byId('btn-redo').addEventListener('click', redo);
