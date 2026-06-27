// ── Erase tool ────────────────────────────────────────────────
// Walls are clipped at the grid cell (only the segment inside the cell is
// removed); other element types are discrete props, so the whole element
// is removed. updateEraseHover mirrors eraseAtCell's own targeting logic so
// the hover preview always matches what a click would actually remove.

import { state, GRID } from './state.js';
import { cellOf, clipSegmentToCell } from './geometry.js';
import { elementOccupiesCell } from './elements.js';
import { adjustSelectionForSplice } from './selection.js';
import { drawMain } from './render.js';
import { pushHistory } from './history.js';

export function eraseAtCell(cellX, cellY) {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];

    if (el.type === 'wall') {
      const clip = clipSegmentToCell(el.x1, el.y1, el.x2, el.y2, cellX, cellY, GRID);
      if (!clip) continue;

      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const MIN_T = 0.04; // drop slivers smaller than ~4% of the wall's length
      const pieces = [];
      if (clip.tMin > MIN_T) {
        pieces.push({ x1: el.x1, y1: el.y1, x2: el.x1 + dx * clip.tMin, y2: el.y1 + dy * clip.tMin });
      }
      if (clip.tMax < 1 - MIN_T) {
        pieces.push({ x1: el.x1 + dx * clip.tMax, y1: el.y1 + dy * clip.tMax, x2: el.x2, y2: el.y2 });
      }

      state.elements.splice(i, 1, ...pieces.map(p => ({ ...el, ...p })));
      adjustSelectionForSplice(i, pieces.length);
      state.eraseHover = null;
      drawMain();
      pushHistory();
      return;
    }

    if (elementOccupiesCell(el, cellX, cellY)) {
      state.elements.splice(i, 1);
      adjustSelectionForSplice(i, 0);
      state.eraseHover = null;
      drawMain();
      pushHistory();
      return;
    }
  }
}

function eraseHoverEquals(a, b) {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'segment') return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
  return a.idx === b.idx;
}

export function updateEraseHover(world) {
  const cellX = cellOf(world.x), cellY = cellOf(world.y);
  let hit = null;
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (el.type === 'wall') {
      const clip = clipSegmentToCell(el.x1, el.y1, el.x2, el.y2, cellX, cellY, GRID);
      if (clip) {
        // Wrap just the segment that would actually be clipped, not the whole
        // grid cell — a cell-sized box around a thin diagonal line doesn't
        // read as "wrapping" the wall.
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        hit = {
          kind: 'segment',
          x1: el.x1 + dx * clip.tMin, y1: el.y1 + dy * clip.tMin,
          x2: el.x1 + dx * clip.tMax, y2: el.y1 + dy * clip.tMax,
          strokeWidth: el.strokeWidth,
        };
        break;
      }
    } else if (elementOccupiesCell(el, cellX, cellY)) {
      hit = { kind: 'element', idx: i };
      break;
    }
  }
  if (!eraseHoverEquals(hit, state.eraseHover)) {
    state.eraseHover = hit;
    drawMain();
  }
}
