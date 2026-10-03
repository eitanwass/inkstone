// ── Erase tool ────────────────────────────────────────────────
// Walls are clipped at the grid cell (only the segment inside the cell is
// removed); other element types are discrete props, so the whole element
// is removed. updateEraseHover mirrors eraseAtCell's own targeting logic so
// the hover preview always matches what a click would actually remove.

import { state } from './state';
import { cellOf } from './geometry';
import { eraseTarget } from './elements';
import type { EraseHover, Point } from './types';
import { adjustSelectionForSplice } from './selection';
import { drawMain } from './render';
import { pushHistory } from './history';

export function eraseAtCell(cellX: number, cellY: number): void {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const target = eraseTarget(state.elements[i], cellX, cellY);
    if (!target) continue;

    state.elements.splice(i, 1, ...target.pieces);
    adjustSelectionForSplice(i, target.pieces.length);
    state.eraseHover = null;
    drawMain();
    pushHistory();
    return;
  }
}

function eraseHoverEquals(a: EraseHover | null, b: EraseHover | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind === 'segment' && b.kind === 'segment') {
    return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
  }
  return a.kind === 'element' && b.kind === 'element' && a.idx === b.idx;
}

export function updateEraseHover(world: Point): void {
  const cellX = cellOf(world.x), cellY = cellOf(world.y);
  let hit: EraseHover | null = null;
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const target = eraseTarget(state.elements[i], cellX, cellY);
    if (!target) continue;
    // Wrap just the part that would actually be removed (a wall segment),
    // not the whole element or grid cell.
    hit = target.highlight
      ? { kind: 'segment', ...target.highlight }
      : { kind: 'element', idx: i };
    break;
  }
  if (!eraseHoverEquals(hit, state.eraseHover)) {
    state.eraseHover = hit;
    drawMain();
  }
}
