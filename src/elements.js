// ── Element queries ───────────────────────────────────────────
// Bounds, hit-testing, and grid-cell occupancy for the four element types
// (rect, wall, token, label). Three functions — getElementBounds,
// hitElement, and elementOccupiesCell — switch on el.type and must be
// extended together when adding a new element type.

import { state, GRID } from './state.js';
import { mCtx } from './canvas.js';
import { rotatePoint, elementCenter, rectCornerLocal, dist, cellOf } from './geometry.js';

export function getElementBounds(el) {
  switch (el.type) {
    case 'rect': {
      const rotation = el.rotation || 0;
      if (!rotation) return { x: el.x, y: el.y, w: el.w, h: el.h };
      const center = elementCenter(el);
      const corners = ['nw', 'ne', 'sw', 'se']
        .map(id => rotatePoint(rectCornerLocal(el, id), center, rotation));
      const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case 'wall': {
      const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
      return { x, y, w: Math.max(Math.abs(el.x2 - el.x1), 1), h: Math.max(Math.abs(el.y2 - el.y1), 1) };
    }
    case 'token': {
      const drawR = el.radius || GRID * 0.42; // matches render.js's fallback
      const r = drawR + 2; // small pad beyond the visible circle
      if (!el.name) return { x: el.x - r, y: el.y - r, w: r * 2, h: r * 2 };
      // Include the name label drawn below the token.
      const nameFontSize = Math.floor(drawR * 0.52);
      mCtx.font = `${nameFontSize}px 'Segoe UI', sans-serif`;
      const nameWidth = mCtx.measureText(el.name).width;
      const halfW = Math.max(r, nameWidth / 2);
      const bottom = el.y + drawR + 10 + nameFontSize;
      return { x: el.x - halfW, y: el.y - r, w: halfW * 2, h: bottom - (el.y - r) };
    }
    case 'label': {
      mCtx.font = `${el.fontSize || 14}px 'Segoe UI', sans-serif`;
      const w = mCtx.measureText(el.text).width;
      return { x: el.x, y: el.y, w, h: el.fontSize || 14 };
    }
  }
  return null;
}

// Shared by handle-drag (rotate) and element-drag (move): snapshot of an
// element's own coordinates, taken at drag start so deltas apply cleanly.
export function snapshotCoords(el) {
  if (el.type === 'wall') return { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
  return { x: el.x, y: el.y };
}

export function hitTest(wx, wy) {
  // Test in reverse order (top elements first)
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (hitElement(el, wx, wy)) return i;
  }
  return null;
}

export function hitElement(el, wx, wy) {
  switch (el.type) {
    case 'rect': {
      const rotation = el.rotation || 0;
      let px = wx, py = wy;
      if (rotation) {
        const local = rotatePoint({ x: wx, y: wy }, elementCenter(el), -rotation);
        px = local.x; py = local.y;
      }
      const { x, y, w, h } = el;
      const rx = w < 0 ? x + w : x;
      const ry = h < 0 ? y + h : y;
      const rw = Math.abs(w), rh = Math.abs(h);
      return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    }
    case 'wall': {
      // Distance from point to segment
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const len2 = dx*dx + dy*dy;
      if (len2 === 0) return dist(wx, wy, el.x1, el.y1) < 10;
      const t = Math.max(0, Math.min(1, ((wx-el.x1)*dx + (wy-el.y1)*dy) / len2));
      return dist(wx, wy, el.x1 + t*dx, el.y1 + t*dy) < 10 / state.zoom;
    }
    case 'token': {
      return dist(wx, wy, el.x, el.y) < (el.radius || GRID * 0.42) + 4;
    }
    case 'label': {
      const fSize = el.fontSize || 14;
      mCtx.font = `${fSize}px 'Segoe UI', sans-serif`;
      const w = mCtx.measureText(el.text).width;
      return wx >= el.x - 2 && wx <= el.x + w + 2 && wy >= el.y - 2 && wy <= el.y + fSize + 2;
    }
  }
  return false;
}

// Used by the erase tool. cellX/Y are top-left corners of the grid cell
// (multiples of GRID). Walls are handled separately (clipSegmentToCell) since
// they erase per-segment, not per-element.
export function elementOccupiesCell(el, cellX, cellY) {
  switch (el.type) {
    case 'rect': {
      // ponytail: ignores rotation (uses the unrotated footprint) — erase is
      // whole-object for rects anyway, only the hit-area shape is approximate.
      const rx = el.x, ry = el.y, rw = el.w, rh = el.h;
      return cellX < rx + rw && cellX + GRID > rx &&
             cellY < ry + rh && cellY + GRID > ry;
    }
    case 'token': {
      // AABB-overlap (same style as rect), not just "is this the center
      // cell" — a large dragged-bigger token should erase from any cell it
      // visually covers, not only the one its center happens to sit in.
      const r = el.radius || GRID * 0.42;
      return cellX < el.x + r && cellX + GRID > el.x - r &&
             cellY < el.y + r && cellY + GRID > el.y - r;
    }
    case 'label': {
      const lx = cellOf(el.x);
      const ly = cellOf(el.y);
      return lx === cellX && ly === cellY;
    }
  }
  return false;
}
