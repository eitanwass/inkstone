// ── First-visit hint ───────────────────────────────────────────
// A welcome on an empty map: how to start, and where the shortcut list is. It goes as soon as
// anything is drawn, and for good: clearing the map later doesn't bring it back, since the
// person has plainly found their way by then. It never takes clicks (see style.css).

import { byId } from './dom';
import { state } from './state';
import { storageGet, storageSet } from './storage';

const SEEN_KEY = 'inkstone-hint-seen';

const hint = byId('first-visit-hint');
let seen = storageGet(SEEN_KEY) !== null;

// Called whenever the map is redrawn, which covers drawing, undo, and a map arriving from a peer.
export function updateFirstVisitHint(): void {
  if (!seen && state.elements.length > 0) {
    seen = true;
    storageSet(SEEN_KEY, '1');
  }
  hint.classList.toggle('hidden', seen);
}
