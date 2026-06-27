// ── Mouse/keyboard interaction on the canvas ──────────────────
// mousemove/down/up, wheel-zoom, Alt-to-pan, and Escape — the orchestration
// layer that ties together handles, selection, and erase based on the
// active tool and what's under the cursor.

import { state, GRID } from './state.js';
import { iCanvas } from './canvas.js';
import { screenToWorld, snapToGrid, cellOf, dist } from './geometry.js';
import { hitTest } from './elements.js';
import { hitHandle, handleCursor, startHandleDrag, applyHandleDrag } from './handles.js';
import { drawGrid, drawMain } from './render.js';
import { startElementDrag, applyElementDrag, finishBoxSelect } from './selection.js';
import { updateEraseHover, eraseAtCell } from './erase.js';
import { pushHistory } from './history.js';
import { openTokenDialog, openTextDialog } from './dialogs.js';
import { hideContextMenus } from './context-menu.js';

export let lastMoveW = { x: 0, y: 0 };

export function updateHoverCursor(world) {
  if (state.altHeld || state.isPanning || state.elementDrag || state.handleDrag || state.isErasing) return;

  if (state.tool === 'select' && state.selected.length === 1) {
    const el = state.elements[state.selected[0]];
    if (el && (el.type === 'rect' || el.type === 'wall' || el.type === 'token')) {
      const h = hitHandle(el, world);
      if (h) { iCanvas.style.cursor = handleCursor(h); return; }
    }
  }

  if (state.tool === 'select' || state.tool === 'token') {
    const idx = hitTest(world.x, world.y);
    if (state.tool === 'token') {
      const prevHover = state.hoveredToken;
      state.hoveredToken = (idx !== null && state.elements[idx]?.type === 'token') ? idx : null;
      if (state.hoveredToken !== prevHover) drawMain();
    }
    if (state.tool === 'select') {
      iCanvas.style.cursor = (idx !== null) ? 'move' : 'default';
    }
  }

  if (state.tool === 'erase') {
    iCanvas.style.cursor = 'cell';
    updateEraseHover(world);
  }
}

function onMouseMove(e) {
  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  lastMoveW = world;

  // Update cursor pos display
  const gx = Math.round(world.x / GRID);
  const gy = Math.round(world.y / GRID);
  document.getElementById('cursor-pos').textContent = `${gx}, ${gy}`;

  if (state.isPanning) {
    state.panX = e.clientX - state.panStart.x;
    state.panY = e.clientY - state.panStart.y;
    drawGrid();
    drawMain();
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

  if (state.isDragging && state.preview) {
    const snappedX = snapToGrid(world.x);
    const snappedY = snapToGrid(world.y);
    const s = state.dragStart;

    if (state.tool === 'rect') {
      state.preview.w = snappedX - s.x;
      state.preview.h = snappedY - s.y;
    } else if (state.tool === 'wall') {
      state.preview.x2 = snappedX;
      state.preview.y2 = snappedY;
    } else if (state.tool === 'token') {
      // Token sizes snap to whole grid-cell diameters (radius steps of
      // GRID/2 -> 1, 2, 3... cells wide, matching D&D's Medium/Large/Huge
      // creature-size convention). Below the default radius it's a dead
      // zone — incidental mouse drift during a plain click shouldn't bump
      // the size up to the first snap step.
      const defaultR = GRID * 0.42;
      const step = GRID / 2;
      const maxR = GRID * 2.5;
      const rawR = dist(s.x, s.y, world.x, world.y);
      state.preview.radius = rawR <= defaultR
        ? defaultR
        : Math.min(maxR, Math.round(rawR / step) * step);
    }
    drawMain();
    return;
  }

  updateHoverCursor(world);
}

function onMouseDown(e) {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle mouse or Alt+left = pan
    state.isPanning = true;
    state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    iCanvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  const snappedX = snapToGrid(world.x);
  const snappedY = snapToGrid(world.y);

  switch (state.tool) {
    case 'select': {
      if (state.selected.length === 1) {
        const target = state.elements[state.selected[0]];
        if (target && (target.type === 'rect' || target.type === 'wall' || target.type === 'token')) {
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
          state.selected = pos === -1
            ? [...state.selected, idx]
            : state.selected.filter(s => s !== idx);
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
        x: snappedX, y: snappedY, w: 0, h: 0,
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
        x1: snappedX, y1: snappedY,
        x2: snappedX, y2: snappedY,
        strokeColor: state.strokeColor,
        strokeWidth: state.strokeWidth,
      };
      break;
    }

    case 'token': {
      // Center stays anchored to the clicked cell; dragging outward grows
      // the radius (still always a circle), released in onMouseUp which
      // opens the name dialog with whatever radius was dragged out.
      const center = { x: snappedX + GRID / 2, y: snappedY + GRID / 2 };
      state.isDragging = true;
      state.dragStart = center;
      state.preview = {
        type: 'token',
        x: center.x, y: center.y,
        radius: GRID * 0.42,
        color: '#e05c5c',
      };
      break;
    }

    case 'text': {
      openTextDialog(world.x, world.y);
      break;
    }
  }
}

function onMouseUp(e) {
  if (state.isErasing) {
    state.isErasing = false;
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
    // Name still needs to be entered before this becomes a real element —
    // openTokenDialog stashes the dragged radius until that dialog confirms.
    openTokenDialog(p.x, p.y, p.radius);
    state.preview = null;
    drawMain();
    return;
  }

  let valid = false;

  if (p.type === 'rect') {
    valid = Math.abs(p.w) > GRID * 0.3 && Math.abs(p.h) > GRID * 0.3;
    if (valid) {
      // Normalize
      if (p.w < 0) { p.x += p.w; p.w = -p.w; }
      if (p.h < 0) { p.y += p.h; p.h = -p.h; }
    }
  } else if (p.type === 'wall') {
    valid = dist(p.x1, p.y1, p.x2, p.y2) > GRID * 0.3;
  }

  if (valid) {
    state.elements.push({ ...p });
    pushHistory();
  }
  state.preview = null;
  drawMain();
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Zoom toward cursor
  const wx = (sx - state.panX) / state.zoom;
  const wy = (sy - state.panY) / state.zoom;

  state.zoom = Math.min(8, Math.max(0.15, state.zoom * factor));

  state.panX = sx - wx * state.zoom;
  state.panY = sy - wy * state.zoom;

  document.getElementById('zoom-label').textContent =
    `${Math.round(state.zoom * 100)}%`;

  drawGrid();
  drawMain();
}

iCanvas.addEventListener('mousemove', onMouseMove);
iCanvas.addEventListener('mousedown', onMouseDown);
iCanvas.addEventListener('mouseup', onMouseUp);
iCanvas.addEventListener('wheel', onWheel, { passive: false });

// ── Alt-to-pan cursor hint ─────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.key !== 'Alt' || state.altHeld) return;
  state.altHeld = true;
  if (!state.isPanning && !state.elementDrag && !state.handleDrag && !state.isDragging && !state.isBoxSelecting) {
    iCanvas.style.cursor = 'grab';
  }
});

window.addEventListener('keyup', e => {
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideContextMenus();
    state.preview = null;
    state.isDragging = false;
    state.isBoxSelecting = false;
    state.selectBox = null;
    state.elementDrag = null;
    state.handleDrag = null;
    state.selected = [];
    drawMain();
  }
});
