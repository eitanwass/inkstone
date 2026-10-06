// ── Pointer/keyboard interaction on the canvas ────────────────
// Pointer events (not separate mouse/touch listeners) so mouse, pen, and
// touch all funnel through one set of handlers. The touch-only parts
// (pinch-zoom/pan, long-press menu) live in touch.js and get first look at
// each event. What a press, drag or release *does* belongs to the active tool
// (tools/): this file only does what every tool shares, like panning.

import { clientToCanvas, clientToWorld, iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { cancelInProgressDrag, GRID, state } from '../core/state';
import type { Point } from '../core/types';
import { drawMain, setView } from '../draw/render';
import { hitTest } from '../elements';
import { hideContextMenus } from '../ui/context-menu';
import { hideConditionsTip, updateConditionsTip } from '../ui/token-card';
import { editSelectedText, zoomAround } from './controls';
import { tools } from './tools';
import type { Tool } from './tools/types';
import { armLongPress, onTouchCancel, onTouchDown, onTouchMove, onTouchUp } from './touch';

export let lastMoveW = { x: 0, y: 0 };

// The tool that took the current press. It keeps the gesture even if the active tool changes
// before the pointer is released.
let gesture: Tool | null = null;

export function updateHoverCursor(world: Point): void {
  if (state.altHeld || state.isPanning || state.elementDrag || state.handleDrag || state.isErasing) return;
  tools[state.tool].hover?.(world);
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

  if (gesture?.move?.(e, world)) return;

  updateHoverCursor(world);
  if (e.pointerType === 'mouse') updateConditionsTip(world, e.clientX, e.clientY); // a fingertip doesn't hover
}

function onPointerDown(e: PointerEvent): void {
  gesture?.cancel?.();
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

  gesture = tools[state.tool];
  gesture.press?.(e, clientToWorld(e.clientX, e.clientY));
}

function onPointerUp(e: PointerEvent): void {
  if (onTouchUp(e)) return;

  if (state.isPanning) {
    state.isPanning = false;
    iCanvas.style.cursor = state.altHeld ? 'grab' : '';
    if (!state.altHeld) updateHoverCursor(lastMoveW);
    return;
  }

  const released = gesture;
  gesture = null;
  released?.release?.(e, clientToWorld(e.clientX, e.clientY));
}

function onPointerCancel(e: PointerEvent): void {
  gesture?.cancel?.();
  gesture = null;
  state.selectBox = null;
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
