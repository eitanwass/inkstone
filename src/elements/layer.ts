// ── Locking elements ────────────────────────────────────────────
// Any element can be locked, so a background room isn't dragged by accident: clicks pass through it to what
// is under it, and it can't be selected, moved, erased or deleted by hand. (It can still be right-clicked,
// to unlock it.) The flag is part of the element, so it saves, syncs and undoes like any other change, and
// is present only when on.
//
// Pure (no DOM), so it is unit tested.

import type { BoardElement } from '../core/types';

export const isLocked = (el: BoardElement): boolean => el.locked === true;

// Whether a click, a box, the eraser or Select All can touch it: not if it is locked.
export const isInteractive = (el: BoardElement): boolean => !isLocked(el);

// Locks or unlocks, leaving the flag off the element rather than set to false (so an element that isn't
// locked saves, and syncs, exactly as it did before there was locking).
export function setLocked(el: BoardElement, on: boolean): void {
  if (on) el.locked = true;
  else delete el.locked;
}
