// ── Element types ─────────────────────────────────────────────
// Elements (state.elements) are plain data — they're saved to localStorage,
// cloned for undo, and sent to collaborators — so they can't carry methods.
// Instead each type has a file in this folder exporting an object of
// behavior, and ELEMENT_TYPES maps el.type to it. The functions below look up
// the type and call into it, so the rest of the app never switches on el.type.
//
// A type object has these methods (all optional unless noted; the default is
// what the dispatcher does when a type leaves one out):
//   draw(ctx, el, isSelected)   required. Strokes/fills with ctx's style
//                               already set from el (see drawElement).
//   bounds(el)                  required. {x, y, w, h} in world space.
//   hit(el, wx, wy)             required. Is the point on the element?
//   occupiesCell(el, cx, cy)    does the element cover this grid cell? Used
//                               by erase, which removes the whole element.
//   erase(el, cx, cy)           overrides occupiesCell for types that erase
//                               piecemeal (wall). Returns null for a miss, or
//                               {pieces, highlight}: the elements left behind
//                               and the part being removed.
//   dimensions(el)              the stretches to measure while the shape is
//                               drawn or resized: a room's width and height,
//                               a wall's length, a token's width. Default none.
//   center(el)                  default {x, y}.
//   snapshot(el)                coordinates to restore from while dragging.
//                               Default {x, y}.
//   translate(el, dx, dy, origin = el)  sets el's coordinates to origin's
//                               plus (dx, dy). Default moves x and y.
//   handles(el, rotateOffset)   resize/rotate handles. A rotate handle has a
//                               `from` point its connector line starts at.
//   rotate(el, rotation, delta, pivot, startCoords)  applies a rotate drag.
//
// To add a type: create its file, then add it to ELEMENT_TYPES.

import { state } from '../state';
import type {
  BoardElement,
  Bounds,
  Coords,
  Dimension,
  ElementBehavior,
  ElementType,
  EraseTarget,
  Handle,
  Point,
} from '../types';
import { label } from './label';
import { rect } from './rect';
import { token } from './token';
import { wall } from './wall';

const ELEMENT_TYPES: { [K in ElementType]: ElementBehavior<Extract<BoardElement, { type: K }>> } = {
  rect,
  wall,
  token,
  label,
};

// Undefined for a type this version doesn't know (e.g. from a newer save), so
// those elements are skipped instead of crashing.
function typeOf<T extends BoardElement>(el: T): ElementBehavior<T> | undefined {
  return ELEMENT_TYPES[el.type] as unknown as ElementBehavior<T> | undefined;
}

export function drawElementShape(ctx: CanvasRenderingContext2D, el: BoardElement, isSelected: boolean): void {
  typeOf(el)?.draw(ctx, el, isSelected);
}

export function getElementBounds(el: BoardElement): Bounds | null {
  return typeOf(el)?.bounds(el) ?? null;
}

// The stretches of el to show a ruler along while it is drawn or resized (none for a type without).
export function getElementDimensions(el: BoardElement): Dimension[] {
  return typeOf(el)?.dimensions?.(el) ?? [];
}

export function hitElement(el: BoardElement, wx: number, wy: number): boolean {
  return typeOf(el)?.hit(el, wx, wy) ?? false;
}

// Topmost element at a world point, as an index into state.elements.
export function hitTest(wx: number, wy: number): number | null {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    if (hitElement(state.elements[i], wx, wy)) return i;
  }
  return null;
}

// What erasing at a grid cell would do to el: null if it's not touched,
// otherwise {pieces, highlight} (see erase above). Whole-element types leave
// no pieces and no highlight.
export function eraseTarget(el: BoardElement, cellX: number, cellY: number): EraseTarget | null {
  const type = typeOf(el);
  if (type?.erase) return type.erase(el, cellX, cellY);
  return type?.occupiesCell?.(el, cellX, cellY) ? { pieces: [], highlight: null } : null;
}

// The point-based types (rect, token, label) don't define center, snapshot or
// translate, so the fallbacks below treat the element as a plain {x, y}.
export function elementCenter(el: BoardElement): Point {
  return typeOf(el)?.center?.(el) ?? { x: (el as Point).x, y: (el as Point).y };
}

export function snapshotCoords(el: BoardElement): Coords {
  return typeOf(el)?.snapshot?.(el) ?? { x: (el as Point).x, y: (el as Point).y };
}

export function translateElement(el: BoardElement, dx: number, dy: number, origin: Coords = el): void {
  const translate = typeOf(el)?.translate;
  if (translate) {
    translate(el, dx, dy, origin);
  } else {
    (el as Point).x = (origin as Point).x + dx;
    (el as Point).y = (origin as Point).y + dy;
  }
}

export function elementHandles(el: BoardElement, rotateOffset: number): Handle[] {
  return typeOf(el)?.handles?.(el, rotateOffset) ?? [];
}

export function rotateElement(
  el: BoardElement,
  rotation: number,
  delta: number,
  pivot: Point,
  startCoords: Coords,
): void {
  typeOf(el)?.rotate?.(el, rotation, delta, pivot, startCoords);
}
