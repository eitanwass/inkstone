// ── Global keyboard shortcuts ──────────────────────────────────
// Tool switching, ? (shortcut list), Home (reset view), F (fit map), +/- zoom, arrow-key nudge, Select all,
// Delete/Backspace, undo/redo, copy/paste.
// Modifier+letter never falls through to the bare tool-shortcut map (so
// Ctrl+V doesn't also switch to the Select tool via the 'v' shortcut).

import { GRID, state } from '../core/state';
import type { Tool } from '../core/types';
import { showConfirm } from '../ui/modal';
import {
  closeShortcutsHelp,
  editSelectedText,
  fitMapToScreen,
  nudgeSelected,
  resetView,
  selectAll,
  toggleShortcutsHelp,
  zoomIn,
  zoomOut,
} from './controls';
import { redo, undo } from './history';
import { lastMoveW } from './pointer';
import { copySelection, deleteSelected, duplicateSelected, pasteClipboard } from './selection';
import { setTool } from './toolbar';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  r: 'rect',
  w: 'wall',
  t: 'token',
  l: 'text',
  e: 'erase',
  m: 'ruler', // measure
};

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};

function confirmAndDeleteSelected(): void {
  const hasToken = state.selected.some((i) => state.elements[i]?.type === 'token');
  if (!hasToken) {
    deleteSelected();
    return;
  }
  const only = state.elements[state.selected[0]];
  const name = only.type === 'token' ? only.name : '';
  const msg =
    state.selected.length > 1
      ? `Remove ${state.selected.length} selected elements?`
      : name
        ? `Remove token "${name}"?`
        : 'Remove this token?';
  showConfirm(msg, deleteSelected);
}

document.addEventListener('keydown', (e) => {
  // Typing into a field, or anything inside an open modal (settings, confirm...), is not a
  // shortcut: arrow keys on a radio button must not also nudge the map behind it.
  if (e.target instanceof HTMLElement) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    // (A dialog that has just closed can still be where focus was for a moment: only a shown one counts.)
    const dialog = e.target.closest('[aria-modal="true"]');
    if (dialog && dialog.getClientRects().length > 0) return;
  }

  // Lowercased so Shift doesn't change the letter (Ctrl+Shift+Z reports 'Z').
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (!mod && TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);

  if (!mod && key === 'f') fitMapToScreen();

  // Enter edits the text of the selected token (its name) or label. Only from the map itself: on a
  // focused button, Enter must still press it.
  if (!mod && key === 'enter' && ['BODY', 'CANVAS'].includes((e.target as HTMLElement).tagName)) {
    editSelectedText();
    // not typed into the field it opens
    if (['token-name-field', 'text-label-input'].includes(document.activeElement?.id ?? ''))
      e.preventDefault();
  }
  if (key === '?') toggleShortcutsHelp();
  if (key === 'escape') closeShortcutsHelp();

  if (key === 'home') {
    resetView();
    e.preventDefault();
  }

  // Plus is Shift+= on most keyboards, so both zoom in. Ctrl+plus stays the browser's.
  if (!mod && (key === '+' || key === '=')) zoomIn();
  if (!mod && key === '-') zoomOut();

  const arrow = ARROWS[key];
  if (arrow && !mod && state.selected.length) {
    // The background picture is nudged a pixel at a time (ten with Shift), to line it up with the grid.
    const step = state.adjustingBackground ? (e.shiftKey ? 10 : 1) / GRID : 1;
    nudgeSelected(arrow[0] * step, arrow[1] * step);
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

  if (key === 'a') {
    selectAll();
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
