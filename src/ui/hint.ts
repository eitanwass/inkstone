// ── The welcome on an empty map ────────────────────────────────
// How to start, where the shortcut list is, and where the library of example maps is. It is there
// whenever the map has nothing on it (a new visitor's, or one cleared or undone back to nothing) and goes
// as soon as anything is on it. It never takes clicks (see src/styles/hint.css).

import { byId } from '../core/dom';
import { state } from '../core/state';

const hint = byId('first-visit-hint');

// Called whenever the map is redrawn, which covers drawing, undo, and a map arriving from someone else.
export function updateFirstVisitHint(): void {
  hint.classList.toggle('hidden', state.elements.length > 0);
}
