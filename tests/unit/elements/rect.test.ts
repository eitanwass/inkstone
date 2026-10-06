import { describe, expect, it } from 'vitest';
import type { RectElement } from '../../../src/core/types';
import { rect } from '../../../src/elements/rect';

const room: RectElement = { type: 'rect', x: 0, y: 0, w: 80, h: 40 };
const turned: RectElement = { ...room, rotation: Math.PI / 2 };

describe('rect.bounds', () => {
  it('is the rect itself when unrotated', () => {
    expect(rect.bounds(room)).toEqual({ x: 0, y: 0, w: 80, h: 40 });
  });

  it('is the box around the rotated corners', () => {
    // Turned a quarter turn around its center (40, 20): 40 wide, 80 tall.
    const b = rect.bounds(turned);
    if (!b) throw new Error('no bounds');
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

describe('rect.dimensions', () => {
  const [width, height] = rect.dimensions?.({ ...room, w: 240, h: 160 }) ?? [];

  it('measures the width along the bottom edge and the height along the right edge', () => {
    expect(width).toMatchObject({ text: '30 ft', from: { x: 0, y: 160 }, to: { x: 240, y: 160 } });
    expect(height).toMatchObject({ text: '20 ft', from: { x: 240, y: 0 }, to: { x: 240, y: 160 } });
  });

  it('pushes each ruler off the room: the width below it, the height to its right', () => {
    expect(width.offset).toEqual({ x: -0, y: 1 });
    expect(height.offset).toEqual({ x: 1, y: 0 });
  });

  it('is two rulers, not one "width × height" label', () => {
    expect(rect.dimensions?.(room)).toHaveLength(2);
  });

  it('gives a square its two rulers too', () => {
    expect(rect.dimensions?.({ ...room, w: 80, h: 80 })?.map((d) => d.text)).toEqual(['10 ft', '10 ft']);
  });

  it('is the same room dragged up and to the left, where width and height are negative', () => {
    const dragged = rect.dimensions?.({ ...room, x: 240, y: 160, w: -240, h: -160 }) ?? [];
    expect(dragged.map((d) => d.text)).toEqual(['30 ft', '20 ft']);
    expect(dragged[0].from).toEqual({ x: 0, y: 160 });
    expect(dragged[1].to).toEqual({ x: 240, y: 160 });
  });

  it('has no ruler for a side with no length yet, as at the start of a drag', () => {
    expect(rect.dimensions?.({ ...room, w: 0, h: 0 })).toEqual([]);
    expect(rect.dimensions?.({ ...room, w: 80, h: 0 })?.map((d) => d.text)).toEqual(['10 ft']);
  });

  it('turns with a rotated room: a quarter turn puts the width on a vertical edge', () => {
    const [w, h] = rect.dimensions?.(turned) ?? [];
    expect(w.text).toBe('10 ft'); // still the room's width, 80 wide
    expect(w.from.x).toBeCloseTo(w.to.x); // now running up and down
    expect(w.offset.x).toBeCloseTo(-1); // "below" has turned to the left
    expect(w.offset.y).toBeCloseTo(0);
    expect(h.text).toBe('5 ft');
  });
});
