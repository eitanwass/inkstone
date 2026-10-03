// ── Selection lifecycle: move, delete, duplicate, copy/paste, reorder ──
// Everything that operates on state.selected as a group. Any splice into
// state.elements here must route index shifts through
// adjustSelectionForSplice to keep state.selected valid.

import { state, GRID } from './state';
import { snapToGrid, rectsOverlap, normalizeRect } from './geometry';
import { getElementBounds, snapshotCoords, translateElement } from './elements';
import { drawMain } from './render';
import { pushHistory } from './history';
import { showToast } from './toast';
import type { BoardElement, Point } from './types';

export function adjustSelectionForSplice(removeIdx: number, insertedCount: number): void {
  const shift = insertedCount - 1;
  state.selected = state.selected
    .filter(s => s !== removeIdx)
    .map(s => s > removeIdx ? s + shift : s);
}

export function deleteSelected() {
  const idxs = [...state.selected].sort((a, b) => b - a);
  idxs.forEach(i => state.elements.splice(i, 1));
  state.selected = [];
  drawMain();
  pushHistory();
}

// Selected indices in ascending (z-order) order.
function selectedIndices() {
  return [...state.selected].sort((a, b) => a - b);
}

// Adds elements to the front (or back) of the z-order, selects exactly them,
// then redraws and records history. Shared by duplicate/paste/reorder.
function addAndSelect(els: BoardElement[], { atBack = false } = {}): void {
  if (atBack) state.elements.unshift(...els);
  else state.elements.push(...els);
  const start = atBack ? 0 : state.elements.length - els.length;
  state.selected = els.map((_, k) => start + k);
  drawMain();
  pushHistory();
}

// Removes the selected elements from state.elements and returns them in
// their original z-order.
function takeSelected() {
  const idxs = selectedIndices();
  const taken = idxs.map(i => state.elements[i]);
  [...idxs].reverse().forEach(i => state.elements.splice(i, 1));
  return taken;
}

export function duplicateSelected() {
  const clones = selectedIndices().map(i => {
    const el = structuredClone(state.elements[i]);
    translateElement(el, GRID, GRID);
    return el;
  });
  addAndSelect(clones);
}

// ── Copy / paste ────────────────────────────────────────────────
// In-memory clipboard (not the OS clipboard) — simpler and just as useful
// for an app where copy/paste never needs to leave the canvas.
export let clipboard: BoardElement[] = [];

export function copySelection() {
  if (!state.selected.length) return;
  clipboard = selectedIndices().map(i => structuredClone(state.elements[i]));
  showToast(clipboard.length > 1 ? `Copied ${clipboard.length} elements` : 'Copied element');
}

function clipboardBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of clipboard) {
    const b = getElementBounds(el);
    if (!b) continue;
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Pastes the clipboard so its bounding-box center lands at anchorWorld,
// preserving the relative layout of a multi-element copy.
export function pasteClipboard(anchorWorld: Point): void {
  if (!clipboard.length) return;
  const bounds = clipboardBounds();
  const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  const dx = snapToGrid(anchorWorld.x - cx), dy = snapToGrid(anchorWorld.y - cy);
  const clones = clipboard.map(el => {
    const clone = structuredClone(el);
    translateElement(clone, dx, dy);
    return clone;
  });
  addAndSelect(clones);
  showToast(clones.length > 1 ? `Pasted ${clones.length} elements` : 'Pasted element');
}

export function bringSelectedToFront() {
  addAndSelect(takeSelected());
}

export function sendSelectedToBack() {
  addAndSelect(takeSelected(), { atBack: true });
}

// ── Moving the selection ──────────────────────────────────────
export function startElementDrag(world: Point): void {
  state.elementDrag = {
    moved: false,
    origin: { x: world.x, y: world.y },
    snapshot: state.selected.map(i => ({ i, coords: snapshotCoords(state.elements[i]) })),
  };
}

export function applyElementDrag(world: Point): void {
  const drag = state.elementDrag;
  if (!drag) return;
  drag.moved = true;
  const { origin, snapshot } = drag;
  const dx = snapToGrid(world.x - origin.x);
  const dy = snapToGrid(world.y - origin.y);
  snapshot.forEach(({ i, coords }) => {
    const el = state.elements[i];
    if (!el) return;
    translateElement(el, dx, dy, coords);
  });
}

// ── Rubber-band box select ────────────────────────────────────
export function finishBoxSelect(): void {
  if (!state.selectBox) return;
  const { x1, y1, x2, y2 } = state.selectBox;
  const box = normalizeRect(x1, y1, x2, y2);

  const hits: number[] = [];
  state.elements.forEach((el, i) => {
    const b = getElementBounds(el);
    if (b && rectsOverlap(box.x, box.y, box.w, box.h, b.x, b.y, b.w, b.h)) hits.push(i);
  });

  if (state.selectionBoxAdditive) {
    state.selected = [...new Set([...state.selected, ...hits])];
  } else {
    state.selected = hits;
  }

  state.isBoxSelecting = false;
  state.selectBox = null;
  drawMain();
}
