// ── Global keyboard shortcuts ──────────────────────────────────
// Tool switching, Home (reset view), Delete/Backspace, undo/redo, copy/paste.
// Modifier+letter never falls through to the bare tool-shortcut map (so
// Ctrl+V doesn't also switch to the Select tool via the 'v' shortcut).

import { state } from './state.js';
import { setTool } from './toolbar.js';
import { resetView } from './view-actions.js';
import { deleteSelected, copySelection, pasteClipboard, duplicateSelected } from './selection.js';
import { undo, redo } from './history.js';
import { showConfirm } from './modal.js';
import { lastMoveW } from './pointer.js';

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const map = { v: 'select', r: 'rect', w: 'wall', t: 'token', l: 'text', e: 'erase' };
  if (!e.ctrlKey && !e.metaKey && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);

  if (e.key === 'Home') {
    resetView();
    e.preventDefault();
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected.length) {
    const hasToken = state.selected.some(i => state.elements[i]?.type === 'token');
    if (hasToken) {
      const msg = state.selected.length > 1
        ? `Remove ${state.selected.length} selected elements?`
        : `Remove token "${state.elements[state.selected[0]].name}"?`;
      showConfirm(msg, deleteSelected);
    } else {
      deleteSelected();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    undo();
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    redo();
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    copySelection();
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    pasteClipboard(lastMoveW);
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    if (state.selected.length) duplicateSelected();
    e.preventDefault();
  }
});
