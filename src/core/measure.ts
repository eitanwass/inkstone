// ── Measuring ──────────────────────────────────────────────────
// How far a stretch of map is, in the game's own units. One grid square is
// `scale.perCell` of `scale.unit`: 5 ft in D&D. `scale` is the one place that
// knows this: the Board settings panel changes it, and the ruler and the size rulers
// read it, so none of them knows about the others.

import { GRID } from './state';

export interface Scale {
  unit: string;
  perCell: number;
  // Count diagonals the way the Dungeon Master's Guide does (see gridDistance) instead of as
  // the true straight-line distance.
  dndDiagonals: boolean;
}

// The units on offer, each with what one square is worth until the player says otherwise.
export const UNITS = [
  { unit: 'ft', label: 'Feet', perCell: 5 },
  { unit: 'm', label: 'Meters', perCell: 1.5 },
  { unit: 'sq', label: 'Squares', perCell: 1 },
] as const;

export const MAX_PER_CELL = 1000;

// Feet, 5 a square, and D&D's way of counting diagonals: this is a map tool for D&D.
export const scale: Scale = { unit: UNITS[0].unit, perCell: UNITS[0].perCell, dndDiagonals: true };

// What one square is worth, if `value` is something that can be: a positive number up to
// MAX_PER_CELL, kept to two decimals. Otherwise null.
export function validPerCell(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 && rounded <= MAX_PER_CELL ? rounded : null;
}

// A scale read back from storage. Anything stored by hand or by another version that is not
// a known unit with a valid size gives null, and the defaults stay. The diagonal rule stays on
// unless stored as exactly false.
export function parseScale(raw: unknown): Scale | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { unit, perCell, dndDiagonals } = raw as Record<string, unknown>;
  const known = UNITS.find((u) => u.unit === unit);
  const size = validPerCell(perCell);
  return known && size !== null
    ? { unit: known.unit, perCell: size, dndDiagonals: dndDiagonals !== false }
    : null;
}

// How far apart two offsets are, in grid squares.
//
// With `dndDiagonals` (the default) it is the Dungeon Master's Guide variant: the first
// diagonal square counts as 1, the second as 2, the third as 1, and so on. Of the squares
// crossed, the shorter side's worth are diagonals and the rest straight, so the cost is the
// longer side plus half the shorter, rounded down: 4 across and 4 down is 4 + 2 = 6 squares.
// (It counts whole squares; a ruler held at half a square just rounds its extra down.)
//
// Without it, it is the true straight-line distance: 3 across and 4 down is 5 squares, and a
// 45° line is about 1.41 times a straight one of the same reach.
export function gridDistance(dx: number, dy: number): number {
  const across = Math.abs(dx) / GRID;
  const down = Math.abs(dy) / GRID;
  if (!scale.dndDiagonals) return Math.hypot(across, down);
  return Math.max(across, down) + Math.floor(Math.min(across, down) / 2);
}

// A number of squares as a length: "15 ft", "12.5 ft" (never more than one decimal).
export function formatDistance(cells: number): string {
  return `${trim(cells * scale.perCell)} ${scale.unit}`;
}

function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}
