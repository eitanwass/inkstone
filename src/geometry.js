// ── Pure math helpers ─────────────────────────────────────────
// Coordinate conversion, rotation, and segment/cell clipping. No DOM, no
// element-type knowledge — just numbers in, numbers out.

import { state, GRID } from './state.js';

export function screenToWorld(sx, sy) {
  return {
    x: (sx - state.panX) / state.zoom,
    y: (sy - state.panY) / state.zoom,
  };
}

export function snapToGrid(v) {
  return Math.round(v / GRID) * GRID;
}

// Which grid cell's origin (top-left) a point falls inside — a floor, not a
// round. Used for erase targeting: "nearest grid line" (snapToGrid) and
// "the cell containing this point" disagree for any point past the
// midpoint of a cell, which previously made erase miss near a shape's edge.
export function cellOf(v) {
  return Math.floor(v / GRID) * GRID;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Rotate point p by angle (radians) around pivot. Used for both rendering
// rotated rects and for resize/rotate handle math (de-rotating mouse coords
// into an element's local frame).
export function rotatePoint(p, pivot, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = p.x - pivot.x, dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

export function rotateVector(x, y, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export function elementCenter(el) {
  if (el.type === 'rect') return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
  if (el.type === 'wall') return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 };
  return { x: el.x, y: el.y };
}

export function rectCornerLocal(el, id) {
  const map = {
    nw: { x: el.x,         y: el.y },
    ne: { x: el.x + el.w,  y: el.y },
    sw: { x: el.x,         y: el.y + el.h },
    se: { x: el.x + el.w,  y: el.y + el.h },
  };
  return map[id];
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Liang-Barsky segment-vs-cell clip. Returns the [tMin, tMax] parametric
// interval (0..1 along the segment) that lies inside the cell, or null.
export function clipSegmentToCell(x1, y1, x2, y2, cx, cy, size) {
  const minX = cx, maxX = cx + size, minY = cy, maxY = cy + size;
  const dx = x2 - x1, dy = y2 - y1;
  let tMin = 0, tMax = 1;
  for (const [p, q] of [[-dx, x1 - minX], [dx, maxX - x1], [-dy, y1 - minY], [dy, maxY - y1]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) tMin = Math.max(tMin, t);
    else       tMax = Math.min(tMax, t);
    if (tMin > tMax) return null;
  }
  return { tMin, tMax };
}
