import { afterEach, describe, expect, it } from 'vitest';
import {
  cellOf,
  clampZoom,
  clipSegmentToCell,
  dist,
  normalizeRect,
  rectCornerLocal,
  rectsOverlap,
  rotatePoint,
  rotateVector,
  screenToWorld,
  snapToGrid,
} from '../../src/geometry';
import { GRID, MAX_ZOOM, MIN_ZOOM, state } from '../../src/state';

const closeTo = (actual: { x: number; y: number }, x: number, y: number) => {
  expect(actual.x).toBeCloseTo(x);
  expect(actual.y).toBeCloseTo(y);
};

describe('snapToGrid vs cellOf', () => {
  it('snapToGrid rounds to the nearest grid line', () => {
    expect(snapToGrid(19)).toBe(0);
    expect(snapToGrid(21)).toBe(GRID);
    expect(snapToGrid(59)).toBe(GRID);
    expect(snapToGrid(61)).toBe(2 * GRID);
    expect(snapToGrid(-21)).toBe(-GRID);
  });

  it('cellOf floors to the cell origin, even past the midpoint of the cell', () => {
    expect(cellOf(0)).toBe(0);
    expect(cellOf(39)).toBe(0);
    expect(cellOf(GRID)).toBe(GRID);
    expect(cellOf(79.9)).toBe(GRID);
    expect(cellOf(-1)).toBe(-GRID);
  });

  it('disagree near a cell boundary, which is why erase must use cellOf', () => {
    expect(snapToGrid(35)).toBe(GRID);
    expect(cellOf(35)).toBe(0);
  });
});

describe('screenToWorld', () => {
  const original = { panX: state.panX, panY: state.panY, zoom: state.zoom };
  afterEach(() => Object.assign(state, original));

  it('undoes pan and zoom', () => {
    Object.assign(state, { panX: 100, panY: 50, zoom: 2 });
    expect(screenToWorld(140, 70)).toEqual({ x: 20, y: 10 });
  });
});

describe('clampZoom', () => {
  it('limits zoom to the allowed range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('dist', () => {
  it('is the straight-line distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(1, 1, 1, 1)).toBe(0);
  });
});

describe('rotation', () => {
  it('rotatePoint turns a point around a pivot', () => {
    closeTo(rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2), 0, 1);
    closeTo(rotatePoint({ x: 11, y: 10 }, { x: 10, y: 10 }, Math.PI), 9, 10);
  });

  it('rotatePoint by zero leaves the point alone', () => {
    closeTo(rotatePoint({ x: 7, y: -3 }, { x: 2, y: 2 }, 0), 7, -3);
  });

  it('rotateVector turns a vector around the origin', () => {
    closeTo(rotateVector(0, 1, Math.PI / 2), -1, 0);
    closeTo(rotateVector(3, 4, Math.PI), -3, -4);
  });
});

describe('rectCornerLocal', () => {
  const rect = { type: 'rect', x: 10, y: 20, w: 30, h: 40 } as const;

  it('returns each corner of the unrotated rect', () => {
    expect(rectCornerLocal(rect, 'nw')).toEqual({ x: 10, y: 20 });
    expect(rectCornerLocal(rect, 'ne')).toEqual({ x: 40, y: 20 });
    expect(rectCornerLocal(rect, 'sw')).toEqual({ x: 10, y: 60 });
    expect(rectCornerLocal(rect, 'se')).toEqual({ x: 40, y: 60 });
  });
});

describe('normalizeRect', () => {
  it('gives the same box whichever corner comes first', () => {
    expect(normalizeRect(10, 20, 50, 80)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(normalizeRect(50, 80, 10, 20)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(normalizeRect(50, 20, 10, 80)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
  });
});

describe('rectsOverlap', () => {
  it('detects overlap', () => {
    expect(rectsOverlap(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
    expect(rectsOverlap(0, 0, 10, 10, 2, 2, 3, 3)).toBe(true); // contained
  });

  it('treats touching edges and gaps as no overlap', () => {
    expect(rectsOverlap(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
    expect(rectsOverlap(0, 0, 10, 10, 20, 20, 5, 5)).toBe(false);
  });
});

describe('clipSegmentToCell', () => {
  // A horizontal segment from x=0 to x=120 at y=20, against the cell x 40..80, y 0..40.
  it('returns the parametric span of the segment inside the cell', () => {
    const clip = clipSegmentToCell(0, 20, 120, 20, 40, 0, GRID);
    expect(clip?.tMin).toBeCloseTo(1 / 3);
    expect(clip?.tMax).toBeCloseTo(2 / 3);
  });

  it('returns the whole segment when it is entirely inside the cell', () => {
    expect(clipSegmentToCell(45, 10, 70, 30, 40, 0, GRID)).toEqual({ tMin: 0, tMax: 1 });
  });

  it('starts at 0 when the segment begins inside the cell', () => {
    const clip = clipSegmentToCell(50, 20, 200, 20, 40, 0, GRID);
    expect(clip?.tMin).toBe(0);
    expect(clip?.tMax).toBeCloseTo(30 / 150);
  });

  it('returns null when the segment misses the cell', () => {
    expect(clipSegmentToCell(0, 100, 120, 100, 40, 0, GRID)).toBeNull(); // parallel, outside
    expect(clipSegmentToCell(0, 0, 30, 0, 40, 0, GRID)).toBeNull(); // stops short
    expect(clipSegmentToCell(100, 0, 140, 40, 40, 0, GRID)).toBeNull(); // passes beside it
  });

  it('handles a diagonal crossing the cell', () => {
    const clip = clipSegmentToCell(0, 0, 120, 120, 40, 40, GRID);
    expect(clip?.tMin).toBeCloseTo(1 / 3);
    expect(clip?.tMax).toBeCloseTo(2 / 3);
  });
});
