// ── Right-click context menus ─────────────────────────────────
// Opens the right menu for what was clicked and holds the generic element menu. The others are in
// token-menu.ts (a token: rename, recolor, conditions...) and canvas-menu.ts (the empty map: Paste
// and the map's background); what they share is in menu-kit.ts.

import { clientToWorld, iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import { drawMain } from '../draw/render';
import { hitTest, hitTestAny } from '../elements';
import { isLocked } from '../elements/layer';
import { editSelectedText } from '../input/controls';
import { lockElements } from '../input/layers';
import {
  bringSelectedToFront,
  copySelection,
  deleteSelected,
  duplicateSelected,
  sendSelectedToBack,
} from '../input/selection';
import { showCanvasContextMenu } from './canvas-menu';
import { hideContextMenus, placeMenu, showLockState } from './menu-kit';
import { showTokenContextMenu } from './token-menu';

export { hideContextMenus };

let lockedTarget: number | null = null; // the locked element the open menu is for, if it is for one

// Set by pointer.js right before it opens the menu itself for a touch
// long-press, so the native 'contextmenu' event some browsers (Android
// Chrome) still fire for that same gesture doesn't reopen/re-hit-test it.
let suppressNextContextMenu = false;
export function suppressNativeContextMenu() {
  suppressNextContextMenu = true;
}

// Shared by the native 'contextmenu' event (mouse right-click) and the
// touch long-press gesture in pointer.js, which has no native equivalent —
// iOS Safari never fires 'contextmenu' for a canvas long-press.
export function openContextMenuAt(clientX: number, clientY: number): void {
  hideContextMenus();
  if (state.adjustingBackground) return; // the picture has its own panel

  const world = clientToWorld(clientX, clientY);
  const idx = hitTest(world.x, world.y);

  // A locked element can't be clicked, but it can be right-clicked: it gets its usual menu with
  // everything faded out but Unlock.
  const seen = hitTestAny(world.x, world.y);
  lockedTarget = seen !== null && isLocked(state.elements[seen]) ? seen : null;
  if (lockedTarget !== null) {
    if (state.elements[lockedTarget].type === 'token') {
      showTokenContextMenu(clientX, clientY, lockedTarget, true);
    } else {
      showElementContextMenu(clientX, clientY);
    }
  } else if (idx !== null && state.elements[idx].type === 'token') {
    showTokenContextMenu(clientX, clientY, idx, false);
  } else if (idx !== null) {
    if (!state.selected.includes(idx)) state.selected = [idx];
    drawMain();
    showElementContextMenu(clientX, clientY);
  } else {
    showCanvasContextMenu(clientX, clientY, world);
  }
}

// Touch long-press already opens the menu itself (see pointer.js) since
// iOS never fires 'contextmenu' for a canvas; on platforms that do fire it
// for a touch long-press (e.g. Android Chrome), skip the native event so
// the menu isn't opened/hit-tested twice for one gesture.
function onContextMenu(e: MouseEvent): void {
  e.preventDefault();
  if (suppressNextContextMenu) {
    suppressNextContextMenu = false;
    return;
  }
  openContextMenuAt(e.clientX, e.clientY);
}

function showElementContextMenu(cx: number, cy: number): void {
  // "Edit Text" is for a single label, which is what a right-click on one selects (or the locked one).
  const only =
    lockedTarget !== null
      ? state.elements[lockedTarget]
      : state.selected.length === 1
        ? state.elements[state.selected[0]]
        : undefined;
  byId('ctx-edit-text').classList.toggle('hidden', only?.type !== 'label');
  const menu = byId('context-menu');
  showLockState(menu, byId('ctx-lock'), lockedTarget !== null);
  placeMenu(menu, cx, cy);
}

iCanvas.addEventListener('contextmenu', onContextMenu);
document.addEventListener('click', hideContextMenus);

// ── Element menu actions (act on the current selection) ───────
byId('ctx-edit-text').addEventListener('click', editSelectedText);
// The lock row locks what is selected, or unlocks the locked element the menu was opened on.
byId('ctx-lock').addEventListener('click', () => {
  if (lockedTarget !== null) lockElements([lockedTarget], false);
  else lockElements(state.selected, true);
});
byId('ctx-copy').addEventListener('click', copySelection);

const forSelection = (id: string, action: () => void) =>
  byId(id).addEventListener('click', () => {
    if (state.selected.length) action();
  });
forSelection('ctx-delete', deleteSelected);
forSelection('ctx-bring-front', bringSelectedToFront);
forSelection('ctx-send-back', sendSelectedToBack);
forSelection('ctx-duplicate', duplicateSelected);
