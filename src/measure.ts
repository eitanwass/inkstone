// ── Measuring ──────────────────────────────────────────────────
// How far a stretch of map is, in the game's own units. One grid square is
// `scale.perCell` of `scale.unit`: 5 ft in D&D. `scale` is the one place that
// knows this, so a settings panel can change the unit and the size of a square later
// without touching the ruler or the size labels.

import { GRID } from './state';

export const scale = { unit: 'ft', perCell: 5 };

// The straight-line distance between two offsets, in grid squares: 3 across and 4 down is 5
// squares, and a 45° line is about 1.41 times longer than a straight one of the same reach.
// (D&D's "every diagonal square counts as one" rule would be another way to count; a setting
// for that belongs here when there is a settings panel.)
export function gridDistance(dx: number, dy: number): number {
  return Math.hypot(dx, dy) / GRID;
}

// A number of squares as a length: "15 ft", "12.5 ft" (never more than one decimal).
export function formatDistance(cells: number): string {
  return `${trim(cells * scale.perCell)} ${scale.unit}`;
}

function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}
