// ── Resize / rotate handles (rect, wall, token) ─────────────────
// Handle hit-testing and the drag math for dragging one (where the handles
// are is up to each element type). Drawing the handles themselves lives in
// render.ts (it needs canvas access this module doesn't otherwise care about).

import { state, GRID, DEFAULT_TOKEN_RADIUS, MAX_TOKEN_RADIUS, MIN_SHAPE_SIZE } from './state';
import { rotatePoint, rotateVector, rectCornerLocal, dist, snapToGrid } from './geometry';
import { elementCenter, snapshotCoords, elementHandles, rotateElement } from './elements';
import type {
  BoardElement, Corner, Handle, HandleDrag, HandleKind, Point, RectElement, TokenElement, WallElement,
} from './types';

export const HANDLE_RADIUS_PX = 5;
export const HANDLE_HIT_PX = 9;
export const ROTATE_OFFSET_PX = 24;
export const ROTATE_SNAP_STEP = Math.PI / 12; // 15 degrees

export function hasHandles(el: BoardElement | null | undefined): el is BoardElement {
  return !!el && getHandles(el).length > 0;
}

export function getHandles(el: BoardElement): Handle[] {
  return elementHandles(el, ROTATE_OFFSET_PX / state.zoom);
}

export function hitHandle(el: BoardElement, world: Point): Handle | null {
  const r = HANDLE_HIT_PX / state.zoom;
  for (const h of getHandles(el)) {
    if (dist(world.x, world.y, h.x, h.y) < r) return h;
  }
  return null;
}

export function handleCursor(handle: Handle): string {
  if (handle.kind === 'rotate') return 'grab';
  if (handle.kind === 'endpoint') return 'pointer';
  if (handle.kind === 'resize-radius') return 'nwse-resize';
  const cornerCursors: Record<string, string> = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  };
  return cornerCursors[handle.id] || 'move';
}

// ── Dragging a handle ──────────────────────────────────────────
// One entry per handle kind. start() returns the kind-specific fields to keep
// on state.handleDrag for the duration of the drag; apply() updates the
// element from the current mouse position.
type DragOf<K extends HandleKind> = Extract<HandleDrag, { kind: K }>;
type DragFields<K extends HandleKind> = Omit<DragOf<K>, 'kind' | 'idx' | 'moved'>;
// The element type each handle kind edits. getHandles only offers a handle
// kind on an element of the matching type.
interface HandleElements {
  rotate: RectElement | WallElement;
  resize: RectElement;
  endpoint: WallElement;
  'resize-radius': TokenElement;
}
type HandleDragBehaviors = {
  [K in HandleKind]: {
    start(el: HandleElements[K], handle: Handle, world: Point): DragFields<K>;
    apply(el: HandleElements[K], drag: DragOf<K>, world: Point, precise: boolean): void;
  };
};

const HANDLE_DRAGS: HandleDragBehaviors = {
  rotate: {
    start(el, handle, world) {
      const center = elementCenter(el);
      return {
        center,
        startAngle: Math.atan2(world.y - center.y, world.x - center.x),
        startRotation: 'rotation' in el ? el.rotation || 0 : 0,
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
      const anchorId = ({ nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' } as Record<Corner, Corner>)[handle.id as Corner];
      const anchorWorld = rotatePoint(rectCornerLocal(el, anchorId), elementCenter(el), rotation);
      return { corner: handle.id as Corner, rotation, anchorWorld };
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

// The table above is checked per kind, but looking one up by a runtime kind
// loses that pairing, so the dispatchers go through this one loosely-typed view.
interface AnyHandleDragBehavior {
  start(el: BoardElement, handle: Handle, world: Point): object;
  apply(el: BoardElement, drag: HandleDrag, world: Point, precise: boolean): void;
}
const behaviorFor = (kind: HandleKind) => HANDLE_DRAGS[kind] as unknown as AnyHandleDragBehavior;

export function startHandleDrag(idx: number, handle: Handle, world: Point): void {
  const behavior = behaviorFor(handle.kind);
  state.handleDrag = {
    kind: handle.kind,
    idx,
    moved: false,
    ...behavior.start(state.elements[idx], handle, world),
  } as HandleDrag;
}

export function applyHandleDrag(world: Point, precise: boolean): void {
  const drag = state.handleDrag;
  if (!drag) return;
  const el = state.elements[drag.idx];
  if (!el) return;
  drag.moved = true;
  behaviorFor(drag.kind).apply(el, drag, world, precise);
}
