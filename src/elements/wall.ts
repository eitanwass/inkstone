// ── Wall ──────────────────────────────────────────────────────
// A line segment x1,y1 → x2,y2. Has no rotation field: "rotating" a wall
// rotates both endpoints around their shared midpoint.

import { state, GRID } from '../state';
import { rotatePoint, dist, clipSegmentToCell } from '../geometry';
import type { ElementBehavior, Point, WallCoords, WallElement } from '../types';

const MIN_ERASE_SLIVER = 0.04; // drop leftovers under ~4% of the wall's length

const center = (el: WallElement): Point => ({ x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 });

export const wall: ElementBehavior<WallElement, WallCoords> = {
  center,

  draw(ctx, el) {
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
  },

  bounds(el) {
    const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
    return { x, y, w: Math.max(Math.abs(el.x2 - el.x1), 1), h: Math.max(Math.abs(el.y2 - el.y1), 1) };
  },

  // Distance from point to segment.
  hit(el, wx, wy) {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return dist(wx, wy, el.x1, el.y1) < 10;
    const t = Math.max(0, Math.min(1, ((wx - el.x1) * dx + (wy - el.y1) * dy) / len2));
    return dist(wx, wy, el.x1 + t * dx, el.y1 + t * dy) < 10 / state.zoom;
  },

  // Walls erase per grid cell: only the part inside the cell goes, leaving
  // up to two walls behind (pieces). highlight is the part being removed.
  erase(el, cellX, cellY) {
    const clip = clipSegmentToCell(el.x1, el.y1, el.x2, el.y2, cellX, cellY, GRID);
    if (!clip) return null;

    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const pieces = [];
    if (clip.tMin > MIN_ERASE_SLIVER) {
      pieces.push({ x1: el.x1, y1: el.y1, x2: el.x1 + dx * clip.tMin, y2: el.y1 + dy * clip.tMin });
    }
    if (clip.tMax < 1 - MIN_ERASE_SLIVER) {
      pieces.push({ x1: el.x1 + dx * clip.tMax, y1: el.y1 + dy * clip.tMax, x2: el.x2, y2: el.y2 });
    }
    return {
      pieces: pieces.map(p => ({ ...el, ...p })),
      highlight: {
        x1: el.x1 + dx * clip.tMin, y1: el.y1 + dy * clip.tMin,
        x2: el.x1 + dx * clip.tMax, y2: el.y1 + dy * clip.tMax,
        strokeWidth: el.strokeWidth,
      },
    };
  },

  snapshot: (el) => ({ x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 }),

  translate(el, dx, dy, origin = el) {
    el.x1 = origin.x1 + dx; el.y1 = origin.y1 + dy;
    el.x2 = origin.x2 + dx; el.y2 = origin.y2 + dy;
  },

  // An endpoint handle at each end, plus a rotate handle off the midpoint.
  handles(el, rotateOffset) {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len = Math.hypot(dx, dy) || 1;
    const c = center(el);
    const px = -dy / len, py = dx / len; // unit perpendicular
    return [
      { id: 'p1', kind: 'endpoint', x: el.x1, y: el.y1 },
      { id: 'p2', kind: 'endpoint', x: el.x2, y: el.y2 },
      { id: 'rotate', kind: 'rotate', x: c.x + px * rotateOffset, y: c.y + py * rotateOffset, from: c },
    ];
  },

  // startCoords is the snapshot() taken when the rotate drag began.
  rotate(el, rotation, delta, pivot, startCoords) {
    const p1 = rotatePoint({ x: startCoords.x1, y: startCoords.y1 }, pivot, delta);
    const p2 = rotatePoint({ x: startCoords.x2, y: startCoords.y2 }, pivot, delta);
    el.x1 = p1.x; el.y1 = p1.y; el.x2 = p2.x; el.y2 = p2.y;
  },
};
