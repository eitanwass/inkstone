import { describe, expect, it } from 'vitest';
import { rect } from '../../../src/elements/rect';
import type { RectElement } from '../../../src/types';

const room: RectElement = { type: 'rect', x: 0, y: 0, w: 80, h: 40 };
const turned: RectElement = { ...room, rotation: Math.PI / 2 };

describe('rect.bounds', () => {
  it('is the rect itself when unrotated', () => {
    expect(rect.bounds(room)).toEqual({ x: 0, y: 0, w: 80, h: 40 });
  });

  it('is the box around the rotated corners', () => {
    // Turned a quarter turn around its center (40, 20): 40 wide, 80 tall.
    const b = rect.bounds(turned);
    expect(b.x).toBeCloseTo(20);
    expect(b.y).toBeCloseTo(-20);
    expect(b.w).toBeCloseTo(40);
    expect(b.h).toBeCloseTo(80);
  });
});

describe('rect.hit', () => {
  it('hits inside and misses outside', () => {
    expect(rect.hit(room, 40, 20)).toBe(true);
    expect(rect.hit(room, 90, 20)).toBe(false);
    expect(rect.hit(room, 40, 50)).toBe(false);
  });

  it('handles a rect drawn with negative width and height', () => {
    const backwards: RectElement = { type: 'rect', x: 80, y: 80, w: -40, h: -40 };
    expect(rect.hit(backwards, 60, 60)).toBe(true);
    expect(rect.hit(backwards, 100, 100)).toBe(false);
  });

  it('hits the rotated shape, not its unrotated outline', () => {
    expect(rect.hit(turned, 40, -10)).toBe(true); // inside once turned, outside the original
    expect(rect.hit(turned, 5, 20)).toBe(false); // inside the original, outside once turned
  });
});

describe('rect.occupiesCell', () => {
  const big: RectElement = { type: 'rect', x: 0, y: 0, w: 80, h: 80 };

  it('is true for any cell the rect overlaps', () => {
    expect(rect.occupiesCell?.(big, 0, 0)).toBe(true);
    expect(rect.occupiesCell?.(big, 40, 40)).toBe(true);
  });

  it('is false for cells it only touches or does not reach', () => {
    expect(rect.occupiesCell?.(big, 80, 0)).toBe(false);
    expect(rect.occupiesCell?.(big, 0, 200)).toBe(false);
  });
});

describe('rect handles', () => {
  it('has four corner handles and a rotate handle above the top edge', () => {
    const handles = rect.handles?.(room, 24) ?? [];
    expect(handles.map((h) => h.id)).toEqual(['nw', 'ne', 'sw', 'se', 'rotate']);
    const byId = Object.fromEntries(handles.map((h) => [h.id, h]));
    expect(byId.nw).toMatchObject({ x: 0, y: 0, kind: 'resize' });
    expect(byId.se).toMatchObject({ x: 80, y: 40, kind: 'resize' });
    expect(byId.rotate.x).toBeCloseTo(40);
    expect(byId.rotate.y).toBeCloseTo(-24);
    expect(byId.rotate.from).toEqual({ x: 40, y: 0 });
  });

  it('moves with the rotation', () => {
    const se = rect.handles?.(turned, 24).find((h) => h.id === 'se');
    // The SE corner (80, 40) turned a quarter turn around (40, 20) lands at (20, 60).
    expect(se?.x).toBeCloseTo(20);
    expect(se?.y).toBeCloseTo(60);
  });

  it('rotate stores the rotation on the element', () => {
    const el: RectElement = { ...room };
    rect.rotate?.(el, 1.25, 0, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(el.rotation).toBe(1.25);
  });
});
