// ── Global keyboard shortcuts ──────────────────────────────────
// Tool switching, Home (reset view), Delete/Backspace, undo/redo, copy/paste.
// Modifier+letter never falls through to the bare tool-shortcut map (so
// Ctrl+V doesn't also switch to the Select tool via the 'v' shortcut).

import { state } from './state';
import { setTool } from './toolbar';
import { resetView } from './view-actions';
import { deleteSelected, copySelection, pasteClipboard, duplicateSelected } from './selection';
import { undo, redo } from './history';
import { showConfirm } from './modal';
import { lastMoveW } from './pointer';
import type { Tool } from './types';

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
  const map: Record<string, Tool> = { v: 'select', r: 'rect', w: 'wall', t: 'token', l: 'text', e: 'erase' };
  if (!e.ctrlKey && !e.metaKey && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);

  if (e.key === 'Home') {
    resetView();
    e.preventDefault();
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected.length) {
    const hasToken = state.selected.some(i => state.elements[i]?.type === 'token');
    if (hasToken) {
      const only = state.elements[state.selected[0]];
      const msg = state.selected.length > 1
        ? `Remove ${state.selected.length} selected elements?`
        : `Remove token "${only.type === 'token' ? only.name : ''}"?`;
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
