import { afterEach, describe, expect, it } from 'vitest';
import { formatDistance, gridDistance, scale } from '../../src/measure';
import { GRID } from '../../src/state';

const original = { ...scale };
afterEach(() => Object.assign(scale, original));

describe('gridDistance', () => {
  it('counts squares along a straight line', () => {
    expect(gridDistance(3 * GRID, 0)).toBe(3);
    expect(gridDistance(0, -4 * GRID)).toBe(4);
  });

  it('is the true straight-line distance, so a diagonal is longer than a straight line', () => {
    expect(gridDistance(3 * GRID, 4 * GRID)).toBe(5); // the 3-4-5 triangle
    expect(gridDistance(6 * GRID, 6 * GRID)).toBeCloseTo(6 * Math.SQRT2, 10);
    expect(gridDistance(6 * GRID, 6 * GRID)).toBeGreaterThan(gridDistance(6 * GRID, 0));
  });

  it('does not care which way the line points', () => {
    expect(gridDistance(-3 * GRID, -4 * GRID)).toBe(5);
    expect(gridDistance(-3 * GRID, 4 * GRID)).toBe(5);
  });

  it('measures half squares, which the ruler snaps to', () => {
    expect(gridDistance(1.5 * GRID, 0)).toBe(1.5);
  });

  it('is zero for no distance', () => {
    expect(gridDistance(0, 0)).toBe(0);
  });
});

describe('formatDistance', () => {
  it('is 5 ft a square by default', () => {
    expect(formatDistance(1)).toBe('5 ft');
    expect(formatDistance(6)).toBe('30 ft');
    expect(formatDistance(0)).toBe('0 ft');
  });

  it('shows half squares as a decimal and never more than one', () => {
    expect(formatDistance(1.5)).toBe('7.5 ft');
    expect(formatDistance(0.5)).toBe('2.5 ft');
    expect(formatDistance(1 / 3)).toBe('1.7 ft');
  });

  it('shows a 45° line of six squares as about 42.4 ft, more than the 30 ft of a straight one', () => {
    expect(formatDistance(gridDistance(6 * GRID, 0))).toBe('30 ft');
    expect(formatDistance(gridDistance(6 * GRID, 6 * GRID))).toBe('42.4 ft');
  });

  it('follows the scale, so a settings panel can change it later', () => {
    scale.unit = 'm';
    scale.perCell = 1.5;
    expect(formatDistance(4)).toBe('6 m');
    scale.unit = 'sq';
    scale.perCell = 1;
    expect(formatDistance(3)).toBe('3 sq');
  });
});
