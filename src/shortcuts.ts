// ── Global keyboard shortcuts ──────────────────────────────────
// Tool switching, Home (reset view), Delete/Backspace, undo/redo, copy/paste.
// Modifier+letter never falls through to the bare tool-shortcut map (so
// Ctrl+V doesn't also switch to the Select tool via the 'v' shortcut).

import { redo, undo } from './history';
import { showConfirm } from './modal';
import { lastMoveW } from './pointer';
import { copySelection, deleteSelected, duplicateSelected, pasteClipboard } from './selection';
import { state } from './state';
import { setTool } from './toolbar';
import type { Tool } from './types';
import { resetView } from './view-actions';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  r: 'rect',
  w: 'wall',
  t: 'token',
  l: 'text',
  e: 'erase',
};

function confirmAndDeleteSelected(): void {
  const hasToken = state.selected.some((i) => state.elements[i]?.type === 'token');
  if (!hasToken) {
    deleteSelected();
    return;
  }
  const only = state.elements[state.selected[0]];
  const msg =
    state.selected.length > 1
      ? `Remove ${state.selected.length} selected elements?`
      : `Remove token "${only.type === 'token' ? only.name : ''}"?`;
  showConfirm(msg, deleteSelected);
}

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;

  // Lowercased so Shift doesn't change the letter (Ctrl+Shift+Z reports 'Z').
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (!mod && TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);

  if (key === 'home') {
    resetView();
    e.preventDefault();
  }

  if ((key === 'delete' || key === 'backspace') && state.selected.length) {
    confirmAndDeleteSelected();
  }

  if (!mod) return;

  if (key === 'z' && !e.shiftKey) {
    undo();
    e.preventDefault();
  }

  if (key === 'y' || (key === 'z' && e.shiftKey)) {
    redo();
    e.preventDefault();
  }

  if (key === 'c') {
    copySelection();
    e.preventDefault();
  }

  if (key === 'v') {
    pasteClipboard(lastMoveW);
    e.preventDefault();
  }

  if (key === 'd') {
    if (state.selected.length) duplicateSelected();
    e.preventDefault();
  }
});
