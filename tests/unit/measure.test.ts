import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDistance, gridDistance, parseScale, scale, UNITS, validPerCell } from '../../src/measure';
import { GRID } from '../../src/state';

const original = { ...scale };
afterEach(() => Object.assign(scale, original));

describe('the defaults', () => {
  it('are feet, 5 a square, and D&D diagonals: this is a D&D map tool', () => {
    expect(UNITS[0]).toMatchObject({ unit: 'ft', perCell: 5 });
    expect(original).toEqual({ unit: 'ft', perCell: 5, dndDiagonals: true });
  });

  it('count a diagonal the D&D way without anyone turning anything on', () => {
    expect(gridDistance(4 * GRID, 4 * GRID)).toBe(6); // 4 across and 4 down: 1 + 2 + 1 + 2
  });
});

describe('gridDistance as the true straight line (the D&D rule off)', () => {
  beforeEach(() => {
    scale.dndDiagonals = false;
  });

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

describe('gridDistance with the D&D diagonal rule', () => {
  const dnd = (across: number, down: number) => {
    scale.dndDiagonals = true;
    return gridDistance(across * GRID, down * GRID);
  };

  it('counts the diagonals as 1, 2, 1, 2...', () => {
    expect(dnd(1, 1)).toBe(1); // the first diagonal is 1 square
    expect(dnd(2, 2)).toBe(3); // 1 + 2
    expect(dnd(3, 3)).toBe(4); // 1 + 2 + 1
    expect(dnd(4, 4)).toBe(6); // 1 + 2 + 1 + 2
  });

  it('adds the straight squares that are left', () => {
    expect(dnd(5, 2)).toBe(6); // two diagonals (3) and three straight
    expect(dnd(5, 1)).toBe(5); // one diagonal (1) and four straight
    expect(dnd(7, 3)).toBe(8); // three diagonals (4) and four straight
  });

  it('leaves a straight line alone, whichever way it points', () => {
    expect(dnd(6, 0)).toBe(6);
    expect(dnd(0, -6)).toBe(6);
    expect(dnd(-6, 0)).toBe(6);
  });

  it('does not care about the direction of the diagonal', () => {
    expect(dnd(-4, 4)).toBe(6);
    expect(dnd(4, -4)).toBe(6);
    expect(dnd(-4, -4)).toBe(6);
    expect(dnd(2, 5)).toBe(dnd(5, 2));
  });

  it('stays within a square of the true straight line on a long 45° move (15 against 14.14)', () => {
    scale.dndDiagonals = false;
    const straight = gridDistance(10 * GRID, 10 * GRID);
    expect(straight).toBeCloseTo(14.142, 3);
    expect(Math.abs(dnd(10, 10) - straight)).toBeLessThan(1);
    expect(dnd(10, 10)).toBe(15);
  });

  it('is never shorter than the longer side', () => {
    expect(dnd(10, 3)).toBeGreaterThanOrEqual(10);
    expect(dnd(1, 9)).toBeGreaterThanOrEqual(9);
  });

  it('handles the half squares a ruler snaps to by rounding the extra down', () => {
    expect(dnd(1.5, 1.5)).toBe(1.5);
    expect(dnd(3.5, 2)).toBe(4.5);
  });

  it('turns off: back to the true straight line', () => {
    scale.dndDiagonals = false;
    expect(gridDistance(4 * GRID, 4 * GRID)).toBeCloseTo(4 * Math.SQRT2, 10);
  });

  it('shows in the format a table would read: 4 across and 4 down is 30 ft', () => {
    expect(formatDistance(dnd(4, 4))).toBe('30 ft');
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

  it('shows a 45° line of six squares as 45 ft the D&D way, or about 42.4 ft as the crow flies', () => {
    expect(formatDistance(gridDistance(6 * GRID, 0))).toBe('30 ft'); // straight: 30 either way
    expect(formatDistance(gridDistance(6 * GRID, 6 * GRID))).toBe('45 ft'); // 6 + 3 squares
    scale.dndDiagonals = false;
    expect(formatDistance(gridDistance(6 * GRID, 6 * GRID))).toBe('42.4 ft'); // 30 ft × √2
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

describe('validPerCell', () => {
  it('accepts a positive size and keeps two decimals', () => {
    expect(validPerCell(5)).toBe(5);
    expect(validPerCell(1.5)).toBe(1.5);
    expect(validPerCell(1.2345)).toBe(1.23);
    expect(validPerCell(1000)).toBe(1000);
  });

  it('refuses what cannot be a size', () => {
    for (const bad of [0, -5, 0.001, 1001, Number.NaN, Number.POSITIVE_INFINITY, '5', null, undefined]) {
      expect(validPerCell(bad)).toBeNull();
    }
  });
});

describe('parseScale', () => {
  it('reads a known unit with a valid size, with the D&D rule on unless told otherwise', () => {
    expect(parseScale({ unit: 'm', perCell: 2 })).toEqual({ unit: 'm', perCell: 2, dndDiagonals: true });
    expect(parseScale({ unit: 'sq', perCell: 1 })).toEqual({ unit: 'sq', perCell: 1, dndDiagonals: true });
  });

  it('turns the D&D diagonal rule off only when it was stored as exactly false', () => {
    expect(parseScale({ unit: 'ft', perCell: 5, dndDiagonals: false })?.dndDiagonals).toBe(false);
    expect(parseScale({ unit: 'ft', perCell: 5, dndDiagonals: true })?.dndDiagonals).toBe(true);
    for (const odd of ['false', 0, null, undefined, 'no']) {
      expect(parseScale({ unit: 'ft', perCell: 5, dndDiagonals: odd })?.dndDiagonals).toBe(true);
    }
  });

  it('refuses a unit it does not know, a bad size, or something that is not an object', () => {
    expect(parseScale({ unit: 'furlongs', perCell: 5 })).toBeNull();
    expect(parseScale({ unit: 'ft', perCell: -1 })).toBeNull();
    expect(parseScale({ unit: 'ft' })).toBeNull();
    expect(parseScale('ft')).toBeNull();
    expect(parseScale(null)).toBeNull();
    expect(parseScale([5, 'ft'])).toBeNull();
  });

  it('ignores anything else in the object', () => {
    expect(parseScale({ unit: 'ft', perCell: 5, extra: '<script>' })).toEqual({
      unit: 'ft',
      perCell: 5,
      dndDiagonals: true,
    });
  });
});
