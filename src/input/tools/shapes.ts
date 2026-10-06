// ── The rect, wall and token tools ────────────────────────────
// The press starts a preview, the drag reshapes it and the release commits it (or drops it if it
// is too small). Each shape says how in a `Placer`; `placementTool` turns that into a tool.

import { dist, snapToGrid } from '../../core/geometry';
import { DEFAULT_TOKEN_RADIUS, GRID, MAX_TOKEN_RADIUS, MIN_SHAPE_SIZE, state } from '../../core/state';
import type { Point, RectElement, TokenElement, WallElement } from '../../core/types';
import { drawMain } from '../../draw/render';
import { hitTest } from '../../elements';
import { nextTokenColor } from '../../elements/token';
import { pushHistory } from '../history';
import type { Tool } from './types';

type Placed = RectElement | WallElement | TokenElement;

interface Placer<T extends Placed> {
  /** The preview a press at `world` starts, and the point the drag is measured from. */
  begin(world: Point): { preview: T; anchor: Point };
  drag(preview: T, anchor: Point, world: Point): void;
  /** The element to add on release, or null when the shape is too small to keep. */
  finish(preview: T): T | null;
}

const rectPlacer: Placer<RectElement> = {
  begin(world) {
    const x = snapToGrid(world.x);
    const y = snapToGrid(world.y);
    const preview: RectElement = {
      type: 'rect',
      x,
      y,
      w: 0,
      h: 0,
      strokeColor: state.strokeColor,
      fillColor: state.fillColor,
      strokeWidth: state.strokeWidth,
    };
    return { preview, anchor: { x, y } };
  },
  drag(p, anchor, world) {
    p.w = snapToGrid(world.x) - anchor.x;
    p.h = snapToGrid(world.y) - anchor.y;
  },
  finish(p) {
    if (Math.abs(p.w) <= MIN_SHAPE_SIZE || Math.abs(p.h) <= MIN_SHAPE_SIZE) return null;
    // Normalize to a positive width and height.
    return {
      ...p,
      x: p.w < 0 ? p.x + p.w : p.x,
      y: p.h < 0 ? p.y + p.h : p.y,
      w: Math.abs(p.w),
      h: Math.abs(p.h),
    };
  },
};

const wallPlacer: Placer<WallElement> = {
  begin(world) {
    const x = snapToGrid(world.x);
    const y = snapToGrid(world.y);
    const preview: WallElement = {
      type: 'wall',
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
    };
    return { preview, anchor: { x, y } };
  },
  drag(p, _anchor, world) {
    p.x2 = snapToGrid(world.x);
    p.y2 = snapToGrid(world.y);
  },
  finish(p) {
    return dist(p.x1, p.y1, p.x2, p.y2) > MIN_SHAPE_SIZE ? { ...p } : null;
  },
};

const tokenPlacer: Placer<TokenElement> = {
  // Center stays anchored to the clicked cell; dragging outward grows the radius (still always a
  // circle).
  begin(world) {
    const center = { x: snapToGrid(world.x) + GRID / 2, y: snapToGrid(world.y) + GRID / 2 };
    const preview: TokenElement = {
      type: 'token',
      x: center.x,
      y: center.y,
      radius: DEFAULT_TOKEN_RADIUS,
      color: '#e05c5c',
    };
    return { preview, anchor: center };
  },
  // Token sizes snap to whole grid-cell diameters (radius steps of GRID/2 -> 1, 2, 3... cells
  // wide, matching D&D's Medium/Large/Huge creature-size convention). Below the default radius
  // it's a dead zone: incidental mouse drift during a plain click shouldn't bump the size up to
  // the first snap step.
  drag(p, anchor, world) {
    const step = GRID / 2;
    const rawR = dist(anchor.x, anchor.y, world.x, world.y);
    p.radius =
      rawR <= DEFAULT_TOKEN_RADIUS
        ? DEFAULT_TOKEN_RADIUS
        : Math.min(MAX_TOKEN_RADIUS, Math.round(rawR / step) * step);
  },
  // Placed as it is: a plain disc in the next colour, with no name. A name (and more) is added
  // afterwards, from the token itself.
  finish(p) {
    return {
      type: 'token',
      x: p.x,
      y: p.y,
      radius: p.radius ?? DEFAULT_TOKEN_RADIUS,
      color: nextTokenColor(),
    };
  },
};

function placementTool<T extends Placed>(placer: Placer<T>): Tool {
  return {
    press(_e, world) {
      const { preview, anchor } = placer.begin(world);
      state.isDragging = true;
      state.dragStart = anchor;
      state.preview = preview;
    },
    move(_e, world) {
      const preview = state.preview as T | null;
      if (!state.isDragging || !preview || !state.dragStart) return false;
      placer.drag(preview, state.dragStart, world);
      drawMain();
      return true;
    },
    release() {
      const preview = state.preview as T | null;
      if (!state.isDragging || !preview) return;
      state.isDragging = false;
      const placed = placer.finish(preview);
      if (placed) state.elements.push(placed);
      state.preview = null;
      if (placed) pushHistory();
      drawMain();
    },
  };
}

export const rectTool = placementTool(rectPlacer);
export const wallTool = placementTool(wallPlacer);
export const tokenTool: Tool = {
  ...placementTool(tokenPlacer),
  // Hovering a token with the token tool highlights it.
  hover(world) {
    const idx = hitTest(world.x, world.y);
    const prev = state.hoveredToken;
    state.hoveredToken = idx !== null && state.elements[idx]?.type === 'token' ? idx : null;
    if (state.hoveredToken !== prev) drawMain();
  },
};
