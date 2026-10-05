// ── Pointer/keyboard interaction on the canvas ────────────────
// Pointer events (not separate mouse/touch listeners) so mouse, pen, and
// touch all funnel through one set of handlers. The touch-only parts
// (pinch-zoom/pan, long-press menu) live in touch.js and get first look at
// each event.

import { clientToCanvas, clientToWorld, iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { cellOf, dist, snapToGrid, snapToHalfGrid } from '../core/geometry';
import {
  cancelInProgressDrag,
  DEFAULT_TOKEN_RADIUS,
  GRID,
  MAX_TOKEN_RADIUS,
  MIN_SHAPE_SIZE,
  state,
} from '../core/state';
import type { Point } from '../core/types';
import { applyHandleDrag, handleCursor, hasHandles, hitHandle, startHandleDrag } from '../draw/handles';
import { drawMain, setView } from '../draw/render';
import { hitTest } from '../elements';
import { nextTokenColor } from '../elements/token';
import { hideContextMenus } from '../ui/context-menu';
import { textToolClick } from '../ui/label-editor';
import { hideConditionsTip, updateConditionsTip } from '../ui/token-card';
import { editSelectedText, zoomAround } from './controls';
import { eraseAtCell, updateEraseHover } from './erase';
import { pushHistory } from './history';
import { applyElementDrag, finishBoxSelect, startElementDrag } from './selection';
import { armLongPress, onTouchCancel, onTouchDown, onTouchMove, onTouchUp } from './touch';

export let lastMoveW = { x: 0, y: 0 };

export function updateHoverCursor(world: Point): void {
  if (state.altHeld || state.isPanning || state.elementDrag || state.handleDrag || state.isErasing) return;

  if (state.tool === 'select' && state.selected.length === 1) {
    const el = state.elements[state.selected[0]];
    if (hasHandles(el)) {
      const h = hitHandle(el, world);
      if (h) {
        iCanvas.style.cursor = handleCursor(h);
        return;
      }
    }
  }

  if (state.tool === 'select' || state.tool === 'token') {
    const idx = hitTest(world.x, world.y);
    if (state.tool === 'token') {
      const prevHover = state.hoveredToken;
      state.hoveredToken = idx !== null && state.elements[idx]?.type === 'token' ? idx : null;
      if (state.hoveredToken !== prevHover) drawMain();
    }
    if (state.tool === 'select') {
      iCanvas.style.cursor = idx !== null ? 'move' : 'default';
    }
  }

  if (state.tool === 'erase') {
    iCanvas.style.cursor = 'cell';
    updateEraseHover(world);
  }
}

function onPointerMove(e: PointerEvent): void {
  if (onTouchMove(e)) return;

  const world = clientToWorld(e.clientX, e.clientY);
  lastMoveW = world;

  // Update cursor pos display
  const gx = Math.round(world.x / GRID);
  const gy = Math.round(world.y / GRID);
  byId('cursor-pos').textContent = `${gx}, ${gy}`;

  if (state.isPanning && state.panStart) {
    setView(e.clientX - state.panStart.x, e.clientY - state.panStart.y);
    return;
  }

  if (state.handleDrag) {
    applyHandleDrag(world, e.shiftKey);
    drawMain();
    return;
  }

  if (state.elementDrag) {
    applyElementDrag(world);
    drawMain();
    return;
  }

  if (state.isBoxSelecting && state.selectBox) {
    state.selectBox.x2 = world.x;
    state.selectBox.y2 = world.y;
    drawMain();
    return;
  }

  if (state.isErasing) {
    eraseAtCell(cellOf(world.x), cellOf(world.y));
    return;
  }

  if (state.isMeasuring && state.ruler) {
    state.ruler.x2 = snapToHalfGrid(world.x);
    state.ruler.y2 = snapToHalfGrid(world.y);
    drawMain();
    return;
  }

  const preview = state.preview;
  const s = state.dragStart;
  if (state.isDragging && preview && s) {
    const snappedX = snapToGrid(world.x);
    const snappedY = snapToGrid(world.y);

    if (preview.type === 'rect') {
      preview.w = snappedX - s.x;
      preview.h = snappedY - s.y;
    } else if (preview.type === 'wall') {
      preview.x2 = snappedX;
      preview.y2 = snappedY;
    } else if (preview.type === 'token') {
      // Token sizes snap to whole grid-cell diameters (radius steps of
      // GRID/2 -> 1, 2, 3... cells wide, matching D&D's Medium/Large/Huge
      // creature-size convention). Below the default radius it's a dead
      // zone — incidental mouse drift during a plain click shouldn't bump
      // the size up to the first snap step.
      const step = GRID / 2;
      const rawR = dist(s.x, s.y, world.x, world.y);
      preview.radius =
        rawR <= DEFAULT_TOKEN_RADIUS
          ? DEFAULT_TOKEN_RADIUS
          : Math.min(MAX_TOKEN_RADIUS, Math.round(rawR / step) * step);
    }
    drawMain();
    return;
  }

  updateHoverCursor(world);
  if (e.pointerType === 'mouse') updateConditionsTip(world, e.clientX, e.clientY); // a fingertip doesn't hover
}

// Where the text tool was pressed: the label is placed when the pointer is released (and not on the
// press, or the browser, moving focus as the press finishes, would take it from the field the new label
// opens), if nothing turned the press into something else in between.
let pendingLabelAt: Point | null = null;

function onPointerDown(e: PointerEvent): void {
  pendingLabelAt = null;
  hideConditionsTip(); // whatever happens next, the list it was showing is out of date
  if (onTouchDown(e)) return;

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle mouse or Alt+left = pan
    state.isPanning = true;
    state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    iCanvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  armLongPress(e);

  const world = clientToWorld(e.clientX, e.clientY);
  const snappedX = snapToGrid(world.x);
  const snappedY = snapToGrid(world.y);

  switch (state.tool) {
    case 'select': {
      if (state.selected.length === 1) {
        const target = state.elements[state.selected[0]];
        if (hasHandles(target)) {
          const handle = hitHandle(target, world);
          if (handle) {
            startHandleDrag(state.selected[0], handle, world);
            drawMain();
            return;
          }
        }
      }

      const idx = hitTest(world.x, world.y);

      if (idx !== null) {
        if (e.shiftKey) {
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
      break;
    }

    case 'ruler': {
      // From the nearest half square: a grid line, or the middle of a square (where tokens sit).
      const start = { x: snapToHalfGrid(world.x), y: snapToHalfGrid(world.y) };
      state.ruler = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
      state.isMeasuring = true;
      drawMain();
      break;
    }

    case 'erase': {
      // Erase the single element whose center/body covers the clicked grid cell
      eraseAtCell(cellOf(world.x), cellOf(world.y));
      state.isErasing = true;
      break;
    }

    case 'rect': {
      state.isDragging = true;
      state.dragStart = { x: snappedX, y: snappedY };
      state.preview = {
        type: 'rect',
        x: snappedX,
        y: snappedY,
        w: 0,
        h: 0,
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        strokeWidth: state.strokeWidth,
      };
      break;
    }

    case 'wall': {
      state.isDragging = true;
      state.dragStart = { x: snappedX, y: snappedY };
      state.preview = {
        type: 'wall',
        x1: snappedX,
        y1: snappedY,
        x2: snappedX,
        y2: snappedY,
        strokeColor: state.strokeColor,
        strokeWidth: state.strokeWidth,
      };
      break;
    }

    case 'token': {
      // Center stays anchored to the clicked cell; dragging outward grows
      // the radius (still always a circle), released in onPointerUp which
      // opens the name dialog with whatever radius was dragged out.
      const center = { x: snappedX + GRID / 2, y: snappedY + GRID / 2 };
      state.isDragging = true;
      state.dragStart = center;
      state.preview = {
        type: 'token',
        x: center.x,
        y: center.y,
        radius: DEFAULT_TOKEN_RADIUS,
        color: '#e05c5c',
      };
      break;
    }

    case 'text': {
      pendingLabelAt = world;
      break;
    }
  }
}

function onPointerUp(e: PointerEvent): void {
  if (onTouchUp(e)) return;

  if (pendingLabelAt) {
    const at = pendingLabelAt;
    pendingLabelAt = null;
    if (state.tool === 'text') textToolClick(at.x, at.y);
    return;
  }

  if (state.isErasing) {
    state.isErasing = false;
    return;
  }
  if (state.isMeasuring) {
    // The line stays up to be read; a plain click with no drag leaves nothing behind.
    state.isMeasuring = false;
    const r = state.ruler;
    if (r && r.x1 === r.x2 && r.y1 === r.y2) state.ruler = null;
    drawMain();
    return;
  }
  if (state.isPanning) {
    state.isPanning = false;
    iCanvas.style.cursor = state.altHeld ? 'grab' : '';
    if (!state.altHeld) updateHoverCursor(lastMoveW);
    return;
  }

  if (state.handleDrag) {
    const moved = state.handleDrag.moved;
    state.handleDrag = null;
    if (moved) pushHistory();
    drawMain();
    return;
  }

  if (state.elementDrag) {
    const moved = state.elementDrag.moved;
    state.elementDrag = null;
    iCanvas.style.cursor = 'move';
    if (moved) pushHistory();
    drawMain(); // so anything that waited for the drag to end (the token card) comes back
    return;
  }

  if (state.isBoxSelecting) {
    finishBoxSelect();
    return;
  }

  if (!state.isDragging || !state.preview) return;

  state.isDragging = false;

  // Commit preview to elements if it has size
  const p = state.preview;

  if (p.type === 'token') {
    // Placed as it is: a plain disc in the next colour, with no name. A name (and later more)
    // is added afterwards, from the token itself.
    state.elements.push({
      type: 'token',
      x: p.x,
      y: p.y,
      radius: p.radius ?? DEFAULT_TOKEN_RADIUS,
      color: nextTokenColor(),
    });
    state.preview = null;
    drawMain();
    pushHistory();
    return;
  }

  let valid = false;

  if (p.type === 'rect') {
    valid = Math.abs(p.w) > MIN_SHAPE_SIZE && Math.abs(p.h) > MIN_SHAPE_SIZE;
    if (valid) {
      // Normalize
      if (p.w < 0) {
        p.x += p.w;
        p.w = -p.w;
      }
      if (p.h < 0) {
        p.y += p.h;
        p.h = -p.h;
      }
    }
  } else if (p.type === 'wall') {
    valid = dist(p.x1, p.y1, p.x2, p.y2) > MIN_SHAPE_SIZE;
  }

  if (valid) {
    state.elements.push({ ...p });
    pushHistory();
  }
  state.preview = null;
  drawMain();
}

function onPointerCancel(e: PointerEvent): void {
  pendingLabelAt = null;
  onTouchCancel(e);
  state.isPanning = false;
  cancelInProgressDrag();
  drawMain();
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const { x: sx, y: sy } = clientToCanvas(e.clientX, e.clientY);

  zoomAround(sx, sy, factor); // toward the cursor
}

iCanvas.addEventListener('pointermove', onPointerMove);
// Double-clicking a token puts the cursor in its name (its card is already showing: the first
// click selected it); double-clicking a label opens its text to edit.
iCanvas.addEventListener('dblclick', (e) => {
  if (state.tool !== 'select') return;
  const world = clientToWorld(e.clientX, e.clientY);
  const idx = hitTest(world.x, world.y);
  if (idx === null || !['token', 'label'].includes(state.elements[idx].type)) return;
  state.selected = [idx];
  drawMain();
  editSelectedText();
});

iCanvas.addEventListener('pointerleave', hideConditionsTip);
iCanvas.addEventListener('pointerdown', onPointerDown);
iCanvas.addEventListener('pointerup', onPointerUp);
iCanvas.addEventListener('pointercancel', onPointerCancel);
iCanvas.addEventListener('wheel', onWheel, { passive: false });

// ── Alt-to-pan cursor hint ─────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Alt' || state.altHeld) return;
  state.altHeld = true;
  if (
    !state.isPanning &&
    !state.elementDrag &&
    !state.handleDrag &&
    !state.isDragging &&
    !state.isBoxSelecting
  ) {
    iCanvas.style.cursor = 'grab';
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key !== 'Alt') return;
  state.altHeld = false;
  if (!state.isPanning) {
    iCanvas.style.cursor = '';
    updateHoverCursor(lastMoveW);
  }
});

window.addEventListener('blur', () => {
  state.altHeld = false;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenus();
    cancelInProgressDrag();
    state.selected = [];
    drawMain();
  }
});
