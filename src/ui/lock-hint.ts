// ── The lock on a locked element ────────────────────────────────
// A faded padlock on the top right corner of the locked element the mouse is over (with the select tool),
// a fixed size on screen whatever the zoom, on a small dark disc so it reads over any colour. It is a small
// element laid over the map, not drawn on the canvas, so that CSS fades it in (lock-hint.css) and the
// browser does the animation. It follows the mouse itself, and is positioned again after every redraw
// (render.ts's onMainDrawn hook, registered rather than imported to keep the module chain one-way), so it
// stays on its element as the map is panned or zoomed under a mouse that hasn't moved.

import { clientToWorld, iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import { onMainDrawn } from '../draw/render';
import { getElementBounds, hitTestAny } from '../elements';
import { isLocked } from '../elements/layer';

const hint = byId('lock-hint');

const SIZE_PX = 16; // the disc, on screen
const MARGIN_PX = 5; // in from the corner, on screen
const SMALL_PX = 70; // an element smaller than this on screen has its lock beyond the corner

// Where the mouse is over the map (client coordinates), with no button held, or null.
let mouse: { x: number; y: number } | null = null;

// The locked element under the mouse, if the select tool is in use and the mouse is idle over the map.
function lockedUnderMouse() {
  if (!mouse || state.tool !== 'select') return undefined;
  const world = clientToWorld(mouse.x, mouse.y);
  const idx = hitTestAny(world.x, world.y);
  const el = idx === null ? undefined : state.elements[idx];
  return el && isLocked(el) ? el : undefined;
}

function update(): void {
  const el = lockedUnderMouse();
  const bounds = el ? getElementBounds(el) : null;
  if (!bounds) {
    hint.classList.remove('shown');
    return;
  }
  // Inside the corner of a big element; on a small one (a token, a label) it would cover what is there, so
  // it sits out beyond the corner.
  const small = Math.min(bounds.w, bounds.h) * state.zoom < SMALL_PX;
  const inset = small ? -SIZE_PX * 0.3 : MARGIN_PX + SIZE_PX / 2; // negative: outside the corner
  const screen = iCanvas.getBoundingClientRect();
  const right = screen.left + state.panX + (bounds.x + bounds.w) * state.zoom;
  const top = screen.top + state.panY + bounds.y * state.zoom;
  hint.style.left = `${right - inset - SIZE_PX / 2}px`;
  hint.style.top = `${top + inset - SIZE_PX / 2}px`;
  hint.classList.add('shown');
}

iCanvas.addEventListener('pointermove', (e) => {
  // not while dragging, nor for a finger, which doesn't hover
  mouse = e.pointerType === 'mouse' && e.buttons === 0 ? { x: e.clientX, y: e.clientY } : null;
  update();
});
iCanvas.addEventListener('pointerleave', () => {
  mouse = null;
  update();
});

onMainDrawn(update);
