// ── Locking ─────────────────────────────────────────────────────
// What the right-click menus do: lock or unlock some elements, as one undo step. A locked element can't
// be selected, so it is let go of as it is locked. (What locking means is in elements/layer.ts.)

import { state } from '../core/state';
import { drawMain } from '../draw/render';
import { isInteractive, isLocked, setLocked } from '../elements/layer';
import { pushHistory, showUndoToast } from './history';

// Locks or unlocks the elements at these indices (those already so, or that aren't there, are left out;
// nothing to change is no step at all).
export function lockElements(indices: number[], locked: boolean): void {
  const changed = [...new Set(indices)].filter(
    (i) => state.elements[i] && isLocked(state.elements[i]) !== locked,
  );
  if (!changed.length) return;
  for (const i of changed) setLocked(state.elements[i], locked);
  state.selected = state.selected.filter((i) => isInteractive(state.elements[i]));
  drawMain();
  pushHistory();
  const count = changed.length === 1 ? 'it' : `${changed.length} elements`;
  showUndoToast(locked ? `Locked ${count}: right-click it to unlock` : `Unlocked ${count}`);
}
