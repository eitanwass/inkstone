// ── Resize / rotate handles (rect, wall, token) ─────────────────
// Handle hit-testing and the drag math for dragging one (where the handles
// are is up to each element type). Drawing the handles themselves lives in
// render.js (it needs canvas access this module doesn't otherwise care about).

import { state, GRID, DEFAULT_TOKEN_RADIUS, MAX_TOKEN_RADIUS, MIN_SHAPE_SIZE } from './state.js';
import { rotatePoint, rotateVector, rectCornerLocal, dist, snapToGrid } from './geometry.js';
import { elementCenter, snapshotCoords, elementHandles, rotateElement } from './elements/index.js';

export const HANDLE_RADIUS_PX = 5;
export const HANDLE_HIT_PX = 9;
export const ROTATE_OFFSET_PX = 24;
export const ROTATE_SNAP_STEP = Math.PI / 12; // 15 degrees

export function hasHandles(el) {
  return !!el && getHandles(el).length > 0;
}

export function getHandles(el) {
  return elementHandles(el, ROTATE_OFFSET_PX / state.zoom);
}

export function hitHandle(el, world) {
  const r = HANDLE_HIT_PX / state.zoom;
  for (const h of getHandles(el)) {
    if (dist(world.x, world.y, h.x, h.y) < r) return h;
  }
  return null;
}

export function handleCursor(handle) {
  if (handle.kind === 'rotate') return 'grab';
  if (handle.kind === 'endpoint') return 'pointer';
  if (handle.kind === 'resize-radius') return 'nwse-resize';
  return { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }[handle.id] || 'move';
}

// ── Dragging a handle ──────────────────────────────────────────
// One entry per handle kind. start() returns the kind-specific fields to keep
// on state.handleDrag for the duration of the drag; apply() updates the
// element from the current mouse position.
const HANDLE_DRAGS = {
  rotate: {
    start(el, handle, world) {
      const center = elementCenter(el);
      return {
        center,
        startAngle: Math.atan2(world.y - center.y, world.x - center.x),
        startRotation: el.rotation || 0,
        startCoords: snapshotCoords(el),
      };
    },
    apply(el, drag, world, precise) {
      const { center, startAngle, startRotation, startCoords } = drag;
      let rotation = startRotation + (Math.atan2(world.y - center.y, world.x - center.x) - startAngle);
      if (!precise) rotation = Math.round(rotation / ROTATE_SNAP_STEP) * ROTATE_SNAP_STEP;
      drag.displayDeg = Math.round(rotation * 180 / Math.PI);
      rotateElement(el, rotation, rotation - startRotation, center, startCoords);
    },
  },

  // Rect corner. The opposite corner stays fixed in world space, which is
  // what stops a rotated rect drifting as it's resized.
  resize: {
    start(el, handle) {
      const rotation = el.rotation || 0;
      const anchorId = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[handle.id];
      const anchorWorld = rotatePoint(rectCornerLocal(el, anchorId), elementCenter(el), rotation);
      return { corner: handle.id, rotation, anchorWorld };
    },
    apply(el, drag, world) {
      const { corner, rotation, anchorWorld } = drag;
      // De-rotate the mouse position around the (fixed) anchor corner to get
      // its position in the box's local, unrotated frame.
      const local = rotatePoint(world, anchorWorld, -rotation);
      const dx = snapToGrid(local.x - anchorWorld.x);
      const dy = snapToGrid(local.y - anchorWorld.y);

      const signs = {
        se: { sx: 1, sy: 1 }, nw: { sx: -1, sy: -1 },
        ne: { sx: 1, sy: -1 }, sw: { sx: -1, sy: 1 },
      }[corner];
      const w = Math.max(MIN_SHAPE_SIZE, dx * signs.sx);
      const h = Math.max(MIN_SHAPE_SIZE, dy * signs.sy);

      // Offset of the (fixed) anchor corner from the box center, in local axes.
      const anchorOffset = {
        se: { ax: -w / 2, ay: -h / 2 }, nw: { ax: w / 2, ay: h / 2 },
        ne: { ax: -w / 2, ay: h / 2 }, sw: { ax: w / 2, ay: -h / 2 },
      }[corner];
      const rotated = rotateVector(anchorOffset.ax, anchorOffset.ay, rotation);
      const cx = anchorWorld.x - rotated.x;
      const cy = anchorWorld.y - rotated.y;

      el.w = w; el.h = h;
      el.x = cx - w / 2; el.y = cy - h / 2;
    },
  },

  // Wall endpoint: just follows the mouse, snapped to the grid.
  endpoint: {
    start: (el, handle) => ({ which: handle.id }),
    apply(el, drag, world) {
      const sx = snapToGrid(world.x), sy = snapToGrid(world.y);
      if (drag.which === 'p1') { el.x1 = sx; el.y1 = sy; }
      else { el.x2 = sx; el.y2 = sy; }
    },
  },

  // Token radius. Same grid-cell-diameter snapping as placement-drag (GRID/2
  // steps), but no dead zone needed: the handle itself starts already at the
  // current radius, so an un-moved drag naturally re-resolves to ~the same size.
  'resize-radius': {
    start: () => ({}),
    apply(el, drag, world) {
      const step = GRID / 2;
      const rawR = dist(el.x, el.y, world.x, world.y);
      el.radius = Math.max(step, Math.min(MAX_TOKEN_RADIUS, Math.round(rawR / step) * step));
    },
  },
};

export function startHandleDrag(idx, handle, world) {
  const behavior = HANDLE_DRAGS[handle.kind];
  if (!behavior) return;
  state.handleDrag = {
    kind: handle.kind,
    idx,
    moved: false,
    ...behavior.start(state.elements[idx], handle, world),
  };
}

export function applyHandleDrag(world, precise) {
  const drag = state.handleDrag;
  const el = state.elements[drag.idx];
  if (!el) return;
  drag.moved = true;
  HANDLE_DRAGS[drag.kind].apply(el, drag, world, precise);
}
