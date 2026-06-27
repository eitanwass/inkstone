// ── Selection lifecycle: move, delete, duplicate, copy/paste, reorder ──
// Everything that operates on state.selected as a group. Any splice into
// state.elements here must route index shifts through
// adjustSelectionForSplice to keep state.selected valid.

import { state, GRID } from './state.js';
import { snapToGrid, rectsOverlap } from './geometry.js';
import { getElementBounds, snapshotCoords } from './elements.js';
import { drawMain } from './render.js';
import { pushHistory } from './history.js';
import { showToast } from './toast.js';

export function adjustSelectionForSplice(removeIdx, insertedCount) {
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

// Shared by duplicate/paste: offset an element's own coordinates in place.
export function translateElementBy(el, dx, dy) {
  if ('x1' in el) { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy; }
  else { el.x += dx; el.y += dy; }
}

export function duplicateSelected() {
  const OFFSET = GRID;
  const idxs = [...state.selected].sort((a, b) => a - b);
  const clones = idxs.map(i => {
    const el = JSON.parse(JSON.stringify(state.elements[i]));
    translateElementBy(el, OFFSET, OFFSET);
    return el;
  });
  state.elements.push(...clones);
  const start = state.elements.length - clones.length;
  state.selected = clones.map((_, k) => start + k);
  drawMain();
  pushHistory();
}

// ── Copy / paste ────────────────────────────────────────────────
// In-memory clipboard (not the OS clipboard) — simpler and just as useful
// for an app where copy/paste never needs to leave the canvas.
export let clipboard = [];

export function copySelection() {
  if (!state.selected.length) return;
  const idxs = [...state.selected].sort((a, b) => a - b);
  clipboard = idxs.map(i => JSON.parse(JSON.stringify(state.elements[i])));
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
export function pasteClipboard(anchorWorld) {
  if (!clipboard.length) return;
  const bounds = clipboardBounds();
  const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  const dx = snapToGrid(anchorWorld.x - cx), dy = snapToGrid(anchorWorld.y - cy);
  const clones = clipboard.map(el => {
    const clone = JSON.parse(JSON.stringify(el));
    translateElementBy(clone, dx, dy);
    return clone;
  });
  state.elements.push(...clones);
  const start = state.elements.length - clones.length;
  state.selected = clones.map((_, k) => start + k);
  drawMain();
  pushHistory();
  showToast(clones.length > 1 ? `Pasted ${clones.length} elements` : 'Pasted element');
}

export function bringSelectedToFront() {
  const idxs = [...state.selected].sort((a, b) => a - b);
  const moved = idxs.map(i => state.elements[i]);
  [...idxs].sort((a, b) => b - a).forEach(i => state.elements.splice(i, 1));
  state.elements.push(...moved);
  const start = state.elements.length - moved.length;
  state.selected = moved.map((_, k) => start + k);
  drawMain();
  pushHistory();
}

export function sendSelectedToBack() {
  const idxs = [...state.selected].sort((a, b) => a - b);
  const moved = idxs.map(i => state.elements[i]);
  [...idxs].sort((a, b) => b - a).forEach(i => state.elements.splice(i, 1));
  state.elements.unshift(...moved);
  state.selected = moved.map((_, k) => k);
  drawMain();
  pushHistory();
}

// ── Moving the selection ──────────────────────────────────────
export function startElementDrag(world) {
  state.elementDrag = {
    moved: false,
    origin: { x: world.x, y: world.y },
    snapshot: state.selected.map(i => ({ i, coords: snapshotCoords(state.elements[i]) })),
  };
}

export function applyElementDrag(world) {
  state.elementDrag.moved = true;
  const { origin, snapshot } = state.elementDrag;
  const dx = snapToGrid(world.x - origin.x);
  const dy = snapToGrid(world.y - origin.y);
  snapshot.forEach(({ i, coords }) => {
    const el = state.elements[i];
    if (!el) return;
    if ('x1' in coords) {
      el.x1 = coords.x1 + dx; el.y1 = coords.y1 + dy;
      el.x2 = coords.x2 + dx; el.y2 = coords.y2 + dy;
    } else {
      el.x = coords.x + dx; el.y = coords.y + dy;
    }
  });
}

// ── Rubber-band box select ────────────────────────────────────
export function finishBoxSelect() {
  const { x1, y1, x2, y2 } = state.selectBox;
  const bx = Math.min(x1, x2), by = Math.min(y1, y2);
  const bw = Math.abs(x2 - x1), bh = Math.abs(y2 - y1);

  const hits = [];
  state.elements.forEach((el, i) => {
    const b = getElementBounds(el);
    if (b && rectsOverlap(bx, by, bw, bh, b.x, b.y, b.w, b.h)) hits.push(i);
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
