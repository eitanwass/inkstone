// ── The ruler tool ────────────────────────────────────────────
import { snapToHalfGrid } from '../../core/geometry';
import { state } from '../../core/state';
import { drawMain } from '../../draw/render';
import type { Tool } from './types';

export const rulerTool: Tool = {
  // From the nearest half square: a grid line, or the middle of a square (where tokens sit).
  press(_e, world) {
    const start = { x: snapToHalfGrid(world.x), y: snapToHalfGrid(world.y) };
    state.ruler = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
    state.isMeasuring = true;
    drawMain();
  },
  move(_e, world) {
    if (!state.isMeasuring || !state.ruler) return false;
    state.ruler.x2 = snapToHalfGrid(world.x);
    state.ruler.y2 = snapToHalfGrid(world.y);
    drawMain();
    return true;
  },
  // The line stays up to be read; a plain click with no drag leaves nothing behind.
  release() {
    if (!state.isMeasuring) return;
    state.isMeasuring = false;
    const r = state.ruler;
    if (r && r.x1 === r.x2 && r.y1 === r.y2) state.ruler = null;
    drawMain();
  },
};
