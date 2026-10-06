// ── Rectangle (room) ──────────────────────────────────────────
// Stored as x/y/w/h plus an optional rotation in radians, rotating around its
// own center. See index.js for what each method is for.

import { rectCornerLocal, rotatePoint } from '../core/geometry';
import { formatDistance } from '../core/measure';
import { GRID } from '../core/state';
import type { Corner, Dimension, ElementBehavior, Point, RectElement } from '../core/types';

const center = (el: RectElement): Point => ({ x: el.x + el.w / 2, y: el.y + el.h / 2 });

export const rect: ElementBehavior<RectElement> = {
  center,

  // The width, along the bottom edge, and the height, along the right edge, each its own
  // ruler. A room still being dragged out can have a negative width or height, which is
  // the same room, and a side that has no length yet gets no ruler.
  dimensions(el) {
    const w = Math.abs(el.w),
      h = Math.abs(el.h);
    const left = Math.min(el.x, el.x + el.w),
      top = Math.min(el.y, el.y + el.h);
    const pivot = center(el);
    const rotation = el.rotation || 0;
    const turn = (x: number, y: number): Point => rotatePoint({ x, y }, pivot, rotation);
    // The directions "below" and "to the right" of the room, turned with it
    const down = { x: -Math.sin(rotation), y: Math.cos(rotation) };
    const right = { x: Math.cos(rotation), y: Math.sin(rotation) };

    const found: Dimension[] = [];
    if (w) {
      found.push({
        from: turn(left, top + h),
        to: turn(left + w, top + h),
        text: formatDistance(w / GRID),
        offset: down,
      });
    }
    if (h) {
      found.push({
        from: turn(left + w, top),
        to: turn(left + w, top + h),
        text: formatDistance(h / GRID),
        offset: right,
      });
    }
    return found;
  },

  draw(ctx, el) {
    const { x, y, w, h } = el;
    const rotation = el.rotation || 0;
    if (rotation) {
      const c = center(el);
      ctx.translate(c.x, c.y);
      ctx.rotate(rotation);
      ctx.translate(-c.x, -c.y);
    }
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeRect(x, y, w, h);
  },

  // Axis-aligned box around the (possibly rotated) rect.
  bounds(el) {
    const rotation = el.rotation || 0;
    if (!rotation) return { x: el.x, y: el.y, w: el.w, h: el.h };
    const c = center(el);
    const corners = (['nw', 'ne', 'sw', 'se'] as Corner[]).map((id) =>
      rotatePoint(rectCornerLocal(el, id), c, rotation),
    );
    const xs = corners.map((p) => p.x),
      ys = corners.map((p) => p.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  },

  hit(el, wx, wy) {
    const rotation = el.rotation || 0;
    let px = wx,
      py = wy;
    if (rotation) {
      const local = rotatePoint({ x: wx, y: wy }, center(el), -rotation);
      px = local.x;
      py = local.y;
    }
    const { x, y, w, h } = el;
    const rx = w < 0 ? x + w : x;
    const ry = h < 0 ? y + h : y;
    return px >= rx && px <= rx + Math.abs(w) && py >= ry && py <= ry + Math.abs(h);
  },

  // ponytail: ignores rotation (uses the unrotated footprint) — erase is
  // whole-object for rects anyway, only the hit-area shape is approximate.
  occupiesCell(el, cellX, cellY) {
    return cellX < el.x + el.w && cellX + GRID > el.x && cellY < el.y + el.h && cellY + GRID > el.y;
  },

  angle: (el) => el.rotation || 0,

  // Four corner resize handles plus a rotate handle above the top edge.
  handles(el, rotateOffset) {
    const rotation = el.rotation || 0;
    const c = center(el);
    const corners = (['nw', 'ne', 'sw', 'se'] as Corner[]).map((id) => {
      const p = rotatePoint(rectCornerLocal(el, id), c, rotation);
      return { id, kind: 'resize' as const, x: p.x, y: p.y };
    });
    const rotateHandle = rotatePoint({ x: c.x, y: el.y - rotateOffset }, c, rotation);
    const topMid = rotatePoint({ x: c.x, y: el.y }, c, rotation);
    return [...corners, { id: 'rotate', kind: 'rotate', x: rotateHandle.x, y: rotateHandle.y, from: topMid }];
  },

  rotate(el, rotation) {
    el.rotation = rotation;
  },
};
