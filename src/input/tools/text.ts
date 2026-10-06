// ── The text tool ─────────────────────────────────────────────
// A press is a click, or a drag that marks out the area for the text (its height is the font
// size). It is carried out when the pointer is released (and not on the press, or the browser,
// moving focus as the press finishes, would take it from the field the label opens), if nothing
// turned the press into something else in between.
import { clientToWorld } from '../../core/canvas';
import { state } from '../../core/state';
import type { Point } from '../../core/types';
import { drawMain } from '../../draw/render';
import { textToolArea, textToolClick } from '../../ui/label-editor';
import type { Tool } from './types';

const TEXT_DRAG_PX = 5; // less than this on screen is a click with a shaky hand, not a drag
let pending: { world: Point; client: Point; dragged: boolean } | null = null;

export const textTool: Tool = {
  press(e, world) {
    pending = { world, client: { x: e.clientX, y: e.clientY }, dragged: false };
  },
  move(e, world) {
    if (!pending) return false;
    const { world: from, client } = pending;
    if (Math.hypot(e.clientX - client.x, e.clientY - client.y) > TEXT_DRAG_PX) pending.dragged = true;
    if (pending.dragged) {
      state.selectBox = { x1: from.x, y1: from.y, x2: world.x, y2: world.y }; // the area, as it is marked out
      drawMain();
    }
    return true;
  },
  release(e) {
    if (!pending) return;
    const { world, dragged } = pending;
    pending = null;
    state.selectBox = null;
    if (state.tool !== 'text') return;
    if (dragged) textToolArea(world, clientToWorld(e.clientX, e.clientY));
    else textToolClick(world.x, world.y);
    drawMain(); // without the box that marked out the area
  },
  cancel() {
    pending = null;
  },
};
