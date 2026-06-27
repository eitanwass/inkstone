// ── Undo/redo + board persistence ───────────────────────────────
// Whole-document snapshots rather than per-action commands: state.elements
// is small (a hand-drawn map), so cloning it on every mutation is cheap and
// — unlike a command/diff stack — automatically correct for every action
// (move, resize, rotate, erase, reorder, ...) without bespoke undo logic
// per action type.

import { state } from './state.js';
import { drawMain } from './render.js';
import { showToast } from './toast.js';

const history = { stack: [], index: -1 };
const HISTORY_LIMIT = 100;

// Inversion of control, not a direct import: collab.js (which broadcasts
// state to other connected clients) sits above history.js in the module
// chain, so history.js can't import it without creating a cycle. Instead
// collab.js registers itself here and gets called after every change that
// should propagate to peers.
let historyListener = null;
export function setHistoryListener(fn) { historyListener = fn; }

// Persistence piggybacks on the same chokepoint: pushHistory()/undo()/redo()
// all call persistBoard(), which writes state.elements to localStorage. Only
// the board content persists across a reload — the undo/redo stack itself
// does not, so a fresh load always starts with a single history baseline.
const STORAGE_KEY = 'inkstone-board';

export function persistBoard() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.elements));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — persistence is a
    // convenience, not a requirement, so just skip it rather than break the app.
  }
}

export function loadPersistedBoard() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function pushHistory() {
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(JSON.parse(JSON.stringify(state.elements)));
  if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
  persistBoard();
  if (historyListener) historyListener();
}

export function undo() {
  if (history.index <= 0) return;
  history.index--;
  state.elements = JSON.parse(JSON.stringify(history.stack[history.index]));
  state.selected = [];
  drawMain();
  updateUndoRedoButtons();
  persistBoard();
  showToast('Undo');
  if (historyListener) historyListener();
}

export function redo() {
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  state.elements = JSON.parse(JSON.stringify(history.stack[history.index]));
  state.selected = [];
  drawMain();
  updateUndoRedoButtons();
  persistBoard();
  showToast('Redo');
  if (historyListener) historyListener();
}

// Applied when a snapshot arrives from another connected client (collab.js).
// Deliberately bypasses history.stack — undo/redo stays about *your own*
// edits, not a peer's, so undoing right after a remote change doesn't
// silently revert something you didn't do.
export function applyRemoteSnapshot(elements) {
  state.elements = elements;
  state.selected = [];
  drawMain();
  persistBoard();
}

export function updateUndoRedoButtons() {
  document.getElementById('btn-undo').disabled = history.index <= 0;
  document.getElementById('btn-redo').disabled = history.index >= history.stack.length - 1;
}

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
