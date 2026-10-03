import { afterEach, describe, expect, it } from 'vitest';
import { wall } from '../../../src/elements/wall';
import { state } from '../../../src/state';
import type { WallElement } from '../../../src/types';

const horizontal: WallElement = { type: 'wall', x1: 0, y1: 20, x2: 120, y2: 20, strokeWidth: 4 };

describe('wall.erase', () => {
  it('erasing a middle cell splits the wall in two and keeps its style', () => {
    const result = wall.erase?.(horizontal, 40, 0);
    expect(result?.pieces).toHaveLength(2);
    expect(result?.pieces[0]).toMatchObject({
      type: 'wall',
      strokeWidth: 4,
      x1: 0,
      x2: expect.closeTo(40),
      y1: 20,
      y2: 20,
    });
    expect(result?.pieces[1]).toMatchObject({
      type: 'wall',
      strokeWidth: 4,
      x1: expect.closeTo(80),
      x2: 120,
    });
  });

  it('reports the removed segment as the highlight', () => {
    const result = wall.erase?.(horizontal, 40, 0);
    expect(result?.highlight).toEqual({
      x1: expect.closeTo(40),
      y1: 20,
      x2: expect.closeTo(80),
      y2: 20,
      strokeWidth: 4,
    });
  });

  it('erasing at the end of a wall leaves only the other side', () => {
    const result = wall.erase?.(horizontal, 0, 0);
    expect(result?.pieces).toHaveLength(1);
    expect(result?.pieces[0]).toMatchObject({ x1: expect.closeTo(40), x2: 120 });
  });

  it('drops a leftover sliver instead of keeping a tiny wall', () => {
    // The cell ends at x=80 of an 81-long wall: 1 unit (about 1%) would remain.
    const almostAll: WallElement = { type: 'wall', x1: 0, y1: 20, x2: 81, y2: 20 };
    const result = wall.erase?.(almostAll, 40, 0);
    expect(result?.pieces).toHaveLength(1);
    expect(result?.pieces[0]).toMatchObject({ x1: 0, x2: expect.closeTo(40) });
  });

  it('erasing a wall that fits inside the cell removes it entirely', () => {
    const short: WallElement = { type: 'wall', x1: 45, y1: 10, x2: 70, y2: 30 };
    expect(wall.erase?.(short, 40, 0)?.pieces).toEqual([]);
  });

  it('returns null when the cell does not touch the wall', () => {
    expect(wall.erase?.(horizontal, 40, 200)).toBeNull();
  });
});

describe('wall.hit', () => {
  const original = state.zoom;
  afterEach(() => {
    state.zoom = original;
  });

  it('hits points near the line and misses distant ones', () => {
    state.zoom = 1;
    expect(wall.hit(horizontal, 60, 25)).toBe(true);
    expect(wall.hit(horizontal, 60, 40)).toBe(false);
    expect(wall.hit(horizontal, 200, 20)).toBe(false); // past the end
  });

  it('the grab distance shrinks in world units as you zoom in', () => {
    state.zoom = 4;
    expect(wall.hit(horizontal, 60, 25)).toBe(false);
    expect(wall.hit(horizontal, 60, 21)).toBe(true);
  });

  it('a zero-length wall is still hittable around its point', () => {
    const dot: WallElement = { type: 'wall', x1: 50, y1: 50, x2: 50, y2: 50 };
    expect(wall.hit(dot, 55, 50)).toBe(true);
    expect(wall.hit(dot, 80, 50)).toBe(false);
  });
});

describe('wall geometry', () => {
  it('bounds are at least 1 unit thick so a straight wall can be box-selected', () => {
    expect(wall.bounds(horizontal)).toEqual({ x: 0, y: 20, w: 120, h: 1 });
    expect(wall.bounds({ type: 'wall', x1: 30, y1: 10, x2: 10, y2: 50 })).toEqual({
      x: 10,
      y: 10,
      w: 20,
      h: 40,
    });
  });

  it('center is the midpoint', () => {
    expect(wall.center?.(horizontal)).toEqual({ x: 60, y: 20 });
  });

  it('translate moves both endpoints from a snapshot', () => {
    const el: WallElement = { ...horizontal };
    const snap = wall.snapshot?.(el);
    wall.translate?.(el, 40, -10, snap);
    expect(el).toMatchObject({ x1: 40, y1: 10, x2: 160, y2: 10 });
    // Moving again from the same snapshot is absolute, not cumulative.
    wall.translate?.(el, 80, 0, snap);
    expect(el).toMatchObject({ x1: 80, y1: 20, x2: 200, y2: 20 });
  });

  it('rotate turns both endpoints around the pivot', () => {
    const el: WallElement = { type: 'wall', x1: 0, y1: 0, x2: 40, y2: 0 };
    const start = wall.snapshot?.(el);
    if (!start) throw new Error('wall.snapshot is missing');
    wall.rotate?.(el, 0, Math.PI / 2, { x: 20, y: 0 }, start);
    expect(el.x1).toBeCloseTo(20);
    expect(el.y1).toBeCloseTo(-20);
    expect(el.x2).toBeCloseTo(20);
    expect(el.y2).toBeCloseTo(20);
  });

  it('offers an endpoint handle at each end and a rotate handle off the middle', () => {
    const el: WallElement = { type: 'wall', x1: 0, y1: 0, x2: 40, y2: 0 };
    const handles = wall.handles?.(el, 24) ?? [];
    expect(handles.map((h) => `${h.id}:${h.kind}`)).toEqual(['p1:endpoint', 'p2:endpoint', 'rotate:rotate']);
    const rotate = handles[2];
    expect(rotate.x).toBeCloseTo(20);
    expect(rotate.y).toBeCloseTo(24);
    expect(rotate.from).toEqual({ x: 20, y: 0 });
  });
});
