// ── The map's background ───────────────────────────────────────
// A colour and/or a picture behind the whole map, at most one element of this type. It is drawn not here but
// on the grid's layer, behind the dots (draw/grid.ts, which asks `backgroundOf`), so it never covers anything.
// It is out of reach while drawing (elements/layer.ts), the picture is moved and resized only while it is
// being adjusted (ui/background.ts): from its corners, with its proportions kept, to any size (not snapped
// to the grid unless Shift is held, since a scan's own squares must be lined up with ours by eye); not
// rotated. A background with only a colour has no size (x, y, w and h are 0) and no bounds. See index.ts
// for what each method is for.

import type { BackgroundElement, BoardElement, ElementBehavior } from '../core/types';

// The map's background, if it has one.
export const backgroundOf = (elements: BoardElement[]): BackgroundElement | undefined =>
  elements.find((el): el is BackgroundElement => el.type === 'background');

export const background: ElementBehavior<BackgroundElement> = {
  draw() {
    // Drawn on the grid's layer, behind the dots.
  },

  // A colour alone has no extent.
  bounds: (el) => (el.image ? { x: el.x, y: el.y, w: el.w, h: el.h } : null),

  freeform: true,

  hit: (el, wx, wy) => !!el.image && wx >= el.x && wx <= el.x + el.w && wy >= el.y && wy <= el.y + el.h,

  // Four corners of the picture, no rotate handle.
  handles(el) {
    if (!el.image) return [];
    return [
      { id: 'nw', kind: 'resize', x: el.x, y: el.y },
      { id: 'ne', kind: 'resize', x: el.x + el.w, y: el.y },
      { id: 'sw', kind: 'resize', x: el.x, y: el.y + el.h },
      { id: 'se', kind: 'resize', x: el.x + el.w, y: el.y + el.h },
    ];
  },
};
