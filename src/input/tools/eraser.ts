// ── The erase tool ────────────────────────────────────────────
import { iCanvas } from '../../core/canvas';
import { cellOf } from '../../core/geometry';
import { state } from '../../core/state';
import { eraseAtCell, updateEraseHover } from '../erase';
import type { Tool } from './types';

export const eraseTool: Tool = {
  // Erase the single element whose center/body covers the clicked grid cell.
  press(_e, world) {
    eraseAtCell(cellOf(world.x), cellOf(world.y));
    state.isErasing = true;
  },
  move(_e, world) {
    if (!state.isErasing) return false;
    eraseAtCell(cellOf(world.x), cellOf(world.y));
    return true;
  },
  release() {
    state.isErasing = false;
  },
  hover(world) {
    iCanvas.style.cursor = 'cell';
    updateEraseHover(world);
  },
};
