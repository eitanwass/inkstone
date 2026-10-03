// ── Controls ───────────────────────────────────────────────────
// The commands a user can give the map outside any one tool: zooming, going
// home, nudging the selection, selecting everything. This is the one place they
// live; the keyboard (shortcuts.ts), the mouse wheel and the buttons all call
// these instead of carrying their own copy.

import { iCanvas } from './canvas';
import { byId } from './dom';
import { translateElement } from './elements';
import { clampZoom } from './geometry';
import { pushHistory } from './history';
import { closePopover } from './popover';
import { drawMain, setView } from './render';
import { GRID, state } from './state';

// ── View ───────────────────────────────────────────────────────
const ZOOM_STEP = 1.25;

// Zooms by `factor`, keeping the world point under screen position (sx, sy) fixed.
export function zoomAround(sx: number, sy: number, factor: number): void {
  const wx = (sx - state.panX) / state.zoom;
  const wy = (sy - state.panY) / state.zoom;
  const zoom = clampZoom(state.zoom * factor);
  setView(sx - wx * zoom, sy - wy * zoom, zoom);
}

export function zoomIn(): void {
  zoomAround(iCanvas.offsetWidth / 2, iCanvas.offsetHeight / 2, ZOOM_STEP);
}

export function zoomOut(): void {
  zoomAround(iCanvas.offsetWidth / 2, iCanvas.offsetHeight / 2, 1 / ZOOM_STEP);
}

// Single source of truth for the "default" viewport — used both at load and
// by the Reset View button and Home, so they can never disagree on where "home" is.
export function resetView(): void {
  setView(iCanvas.offsetWidth * 0.1, iCanvas.offsetHeight * 0.1, 1);
}

// ── Help ───────────────────────────────────────────────────────
const shortcutsBtn = byId('btn-shortcuts');
const shortcutsPopover = byId('shortcuts-popover');

export function closeShortcutsHelp(): void {
  if (shortcutsPopover.classList.contains('hidden')) return;
  closePopover(shortcutsPopover, shortcutsBtn);
}

// The list sits above its button (bottom-right), so it needs no JS placement.
export function toggleShortcutsHelp(): void {
  if (!shortcutsPopover.classList.contains('hidden')) {
    closeShortcutsHelp();
    return;
  }
  shortcutsPopover.classList.remove('hidden');
  shortcutsBtn.setAttribute('aria-expanded', 'true');
  shortcutsPopover.focus(); // so a keyboard user lands in it; Escape closes it from anywhere
}

shortcutsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShortcutsHelp();
});

document.addEventListener('click', (e) => {
  if (!shortcutsPopover.contains(e.target as Node)) closeShortcutsHelp();
});

// ── Selection ──────────────────────────────────────────────────
// Moves the selection by whole cells (the arrow keys). One undo step per call.
export function nudgeSelected(cellsX: number, cellsY: number): void {
  if (!state.selected.length) return;
  for (const i of state.selected) translateElement(state.elements[i], cellsX * GRID, cellsY * GRID);
  drawMain();
  pushHistory();
}

export function selectAll(): void {
  state.selected = state.elements.map((_, i) => i);
  drawMain();
}
