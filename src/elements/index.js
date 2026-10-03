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

import { state } from '../state.js';
import { rect } from './rect.js';
import { wall } from './wall.js';
import { token } from './token.js';
import { label } from './label.js';

const ELEMENT_TYPES = { rect, wall, token, label };
const typeOf = el => ELEMENT_TYPES[el.type];

export function drawElementShape(ctx, el, isSelected) {
  typeOf(el)?.draw(ctx, el, isSelected);
}

export function getElementBounds(el) {
  return typeOf(el)?.bounds(el) ?? null;
}

export function hitElement(el, wx, wy) {
  return typeOf(el)?.hit(el, wx, wy) ?? false;
}

// Topmost element at a world point, as an index into state.elements.
export function hitTest(wx, wy) {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    if (hitElement(state.elements[i], wx, wy)) return i;
  }
  return null;
}

// What erasing at a grid cell would do to el: null if it's not touched,
// otherwise {pieces, highlight} (see erase above). Whole-element types leave
// no pieces and no highlight.
export function eraseTarget(el, cellX, cellY) {
  const type = typeOf(el);
  if (type?.erase) return type.erase(el, cellX, cellY);
  return type?.occupiesCell?.(el, cellX, cellY) ? { pieces: [], highlight: null } : null;
}

export function elementCenter(el) {
  return typeOf(el)?.center?.(el) ?? { x: el.x, y: el.y };
}

export function snapshotCoords(el) {
  return typeOf(el)?.snapshot?.(el) ?? { x: el.x, y: el.y };
}

export function translateElement(el, dx, dy, origin = el) {
  const translate = typeOf(el)?.translate;
  if (translate) translate(el, dx, dy, origin);
  else { el.x = origin.x + dx; el.y = origin.y + dy; }
}

export function elementHandles(el, rotateOffset) {
  return typeOf(el)?.handles?.(el, rotateOffset) ?? [];
}

export function rotateElement(el, rotation, delta, pivot, startCoords) {
  typeOf(el)?.rotate?.(el, rotation, delta, pivot, startCoords);
}
