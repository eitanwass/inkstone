// ── The select tool ───────────────────────────────────────────
// Click to select, drag to move, grab a handle to resize or rotate, drag on empty map to box-select.
import { iCanvas } from '../../core/canvas';
import { state } from '../../core/state';
import { applyHandleDrag, handleCursor, hasHandles, hitHandle, startHandleDrag } from '../../draw/handles';
import { drawMain } from '../../draw/render';
import { hitTest } from '../../elements';
import { pushHistory } from '../history';
import { applyElementDrag, finishBoxSelect, startElementDrag } from '../selection';
import type { Tool } from './types';

export const selectTool: Tool = {
  press(e, world) {
    if (state.selected.length === 1) {
      const target = state.elements[state.selected[0]];
      const handle = hasHandles(target) ? hitHandle(target, world) : null;
      if (handle) {
        startHandleDrag(state.selected[0], handle, world);
        drawMain();
        return;
      }
    }

    const idx = hitTest(world.x, world.y);
    if (idx !== null) {
      if (e.shiftKey && !state.adjustingBackground) {
        const pos = state.selected.indexOf(idx);
        state.selected = pos === -1 ? [...state.selected, idx] : state.selected.filter((s) => s !== idx);
      } else {
        if (!state.selected.includes(idx)) state.selected = [idx];
        startElementDrag(world);
        iCanvas.style.cursor = 'grabbing';
      }
    } else {
      if (!e.shiftKey) state.selected = [];
      state.isBoxSelecting = true;
      state.selectionBoxAdditive = e.shiftKey;
      state.selectBox = { x1: world.x, y1: world.y, x2: world.x, y2: world.y };
    }
    drawMain();
  },

  move(e, world) {
    if (state.handleDrag) {
      applyHandleDrag(world, e.shiftKey);
    } else if (state.elementDrag) {
      applyElementDrag(world, e.shiftKey);
    } else if (state.isBoxSelecting && state.selectBox) {
      state.selectBox.x2 = world.x;
      state.selectBox.y2 = world.y;
    } else {
      return false;
    }
    drawMain();
    return true;
  },

  release() {
    if (state.handleDrag) {
      const moved = state.handleDrag.moved;
      state.handleDrag = null;
      if (moved) pushHistory();
      drawMain();
    } else if (state.elementDrag) {
      const moved = state.elementDrag.moved;
      state.elementDrag = null;
      iCanvas.style.cursor = 'move';
      if (moved) pushHistory();
      drawMain(); // so anything that waited for the drag to end (the token card) comes back
    } else if (state.isBoxSelecting) {
      finishBoxSelect();
    }
  },

  hover(world) {
    if (state.selected.length === 1) {
      const el = state.elements[state.selected[0]];
      const handle = hasHandles(el) ? hitHandle(el, world) : null;
      if (handle) {
        iCanvas.style.cursor = handleCursor(handle);
        return;
      }
    }
    iCanvas.style.cursor = hitTest(world.x, world.y) !== null ? 'move' : 'default';
  },
};
