// ── Controls ───────────────────────────────────────────────────
// The commands a user can give the map outside any one tool: zooming, going
// home, nudging the selection, selecting everything. This is the one place they
// live; the keyboard (shortcuts.ts), the mouse wheel and the buttons all call
// these instead of carrying their own copy.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { clampZoom } from '../core/geometry';
import { GRID, state } from '../core/state';
import type { Bounds } from '../core/types';
import { drawMain, setView } from '../draw/render';
import { getElementBounds, translateElement } from '../elements';
import { editLabel } from '../ui/label-editor';
import { closePopover } from '../ui/popover';
import { focusTokenName } from '../ui/token-card';
import { pushHistory } from './history';

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

// Frames every element in the part of the screen the panels leave free (the map name and
// action cluster on top, the tool dock below). An empty map goes home instead. A tiny map is
// not blown up past FIT_MAX_ZOOM.
const FIT = { top: 96, bottom: 112, side: 48 };
const FIT_MAX_ZOOM = 2;

export function fitMapToScreen(): void {
  const boxes = state.elements.map(getElementBounds).filter((b): b is Bounds => b !== null);
  if (!boxes.length) {
    resetView();
    return;
  }
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  const availW = Math.max(1, iCanvas.offsetWidth - 2 * FIT.side);
  const availH = Math.max(1, iCanvas.offsetHeight - FIT.top - FIT.bottom);
  const zoom = Math.min(FIT_MAX_ZOOM, clampZoom(Math.min(availW / (x2 - x1 || 1), availH / (y2 - y1 || 1))));
  const centreX = FIT.side + availW / 2;
  const centreY = FIT.top + availH / 2;
  setView(centreX - ((x1 + x2) / 2) * zoom, centreY - ((y1 + y2) / 2) * zoom, zoom);
}

byId('btn-zoom-in').addEventListener('click', zoomIn);
byId('btn-zoom-out').addEventListener('click', zoomOut);
byId('btn-zoom-fit').addEventListener('click', fitMapToScreen);

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

// ── Text ───────────────────────────────────────────────────────
// Edits the text of the one selected token or label (Enter, or a double-click): a token's name in
// its card, a label's text in a field laid over it on the map.
export function editSelectedText(): void {
  if (state.selected.length !== 1) return;
  const el = state.elements[state.selected[0]];
  if (el?.type === 'token') focusTokenName();
  else if (el?.type === 'label') editLabel(el);
}

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
