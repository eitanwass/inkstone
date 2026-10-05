// ── Right-click context menus ─────────────────────────────────
// Three menus: the generic element menu, the token-specific menu (rename/
// recolor don't make sense for a multi-selection), and the empty-canvas
// menu: Paste when the clipboard has something in it, and the map's background (an image, a colour).

import { conditionBadge } from '../conditions/icon';
import { allConditions } from '../conditions/library';
import { hasCondition, toggleCondition } from '../conditions/tokens';
import { clientToWorld, iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { Point, TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { hitTest, hitTestAny } from '../elements';
import { isLocked } from '../elements/layer';
import { editSelectedText } from '../input/controls';
import { pushHistory, showUndoToast } from '../input/history';
import { lockElements } from '../input/layers';
import {
  bringSelectedToFront,
  clipboard,
  copySelection,
  deleteSelected,
  duplicateSelected,
  pasteClipboard,
  sendSelectedToBack,
} from '../input/selection';
import {
  chooseBackgroundPicture,
  currentColor,
  hasPicture,
  keepBackground,
  MAP_COLORS,
  removePicture,
  setColor,
  startAdjusting,
} from './background';
import { showConfirm } from './modal';
import { chooseTokenColor, nameToken } from './token-card';

// What the open menu acts on: the right-clicked token, or the spot to paste at.
let tokenMenuTarget: number | null = null;
let pasteAnchor: Point | null = null;
let lockedTarget: number | null = null; // the locked element the open menu is for, if it is for one

function tokenAt(idx: number | null): TokenElement | null {
  const el = idx === null ? undefined : state.elements[idx];
  return el?.type === 'token' ? el : null;
}

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
    if (state.elements[lockedTarget].type === 'token') showTokenContextMenu(clientX, clientY, lockedTarget);
    else showElementContextMenu(clientX, clientY);
  } else if (idx !== null && state.elements[idx].type === 'token') {
    showTokenContextMenu(clientX, clientY, idx);
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

// Phone screens are small enough that a menu opened near an edge (very
// plausible — a long-press works anywhere on the map, not just the
// roomy center of a desktop window) can otherwise render partly
// off-screen with no way to reach its lower items.
function placeMenu(menu: HTMLElement, cx: number, cy: number): void {
  menu.style.left = `${cx}px`;
  menu.style.top = `${cy}px`;
  menu.classList.remove('hidden');
  const { offsetWidth: w, offsetHeight: h } = menu;
  const maxLeft = window.innerWidth - w - 8;
  const maxTop = window.innerHeight - h - 8;
  if (cx > maxLeft) menu.style.left = `${Math.max(8, maxLeft)}px`;
  if (cy > maxTop) menu.style.top = `${Math.max(8, maxTop)}px`;
}

// Fades out every item of a menu but the lock row (which becomes Unlock) when it is for a locked element,
// and gives them all back otherwise.
function showLockState(menu: HTMLElement, lockRow: HTMLElement): void {
  const locked = lockedTarget !== null;
  for (const item of menu.querySelectorAll<HTMLElement>('.ctx-item')) {
    const off = locked && item !== lockRow;
    item.classList.toggle('disabled', off);
    item.setAttribute('aria-disabled', String(off));
  }
  lockRow.querySelector('use')?.setAttribute('href', `/icons.svg#icon-${locked ? 'unlock' : 'lock'}`);
  const text = lockRow.querySelector('.ctx-text');
  if (text) text.textContent = locked ? 'Unlock' : 'Lock';
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
  showLockState(menu, byId('ctx-lock'));
  placeMenu(menu, cx, cy);
}

function showTokenContextMenu(cx: number, cy: number, idx: number): void {
  const menu = byId('token-context-menu');
  // A token with no name is offered one; a named token a new name.
  byId('ctx-token-rename').textContent = tokenAt(idx)?.name ? '✏ Rename' : '✏ Add name';
  showLockState(menu, byId('ctx-token-lock'));
  placeMenu(menu, cx, cy);
  tokenMenuTarget = idx;
}

function showCanvasContextMenu(cx: number, cy: number, world: Point): void {
  const menu = byId('canvas-context-menu');
  const canPaste = clipboard.length > 0;
  byId('ctx-paste').classList.toggle('hidden', !canPaste);
  byId('ctx-paste-divider').classList.toggle('hidden', !canPaste);
  // The picture: added, or (when there is one) replaced, adjusted or removed.
  const picture = hasPicture();
  const addText = byId('ctx-bg-add').querySelector('.ctx-text');
  if (addText) addText.textContent = picture ? 'Replace image…' : 'Add image…';
  byId('ctx-bg-adjust').classList.toggle('hidden', !picture);
  byId('ctx-bg-remove').classList.toggle('hidden', !picture);
  markBackgroundColors();
  placeMenu(menu, cx, cy);
  pasteAnchor = world;
}

// ── The map's background, in the empty-canvas menu ────────────
const colorRow = byId('ctx-bg-colors');
const customColor = byId<HTMLInputElement>('ctx-bg-color-custom');
const customLabel = customColor.closest('label') as HTMLElement;

for (const { name, hex } of MAP_COLORS) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'ctx-swatch';
  swatch.dataset.color = hex;
  swatch.style.backgroundColor = hex;
  swatch.title = name;
  swatch.setAttribute('aria-label', name);
  swatch.addEventListener('click', () => {
    setColor(hex);
    keepBackground(); // the document click that follows closes the menu
  });
  colorRow.insertBefore(swatch, customLabel);
}

// Marks the colour in use (the ring too, if it is not one of the swatches).
function markBackgroundColors(): void {
  const current = currentColor().toLowerCase();
  let preset = false;
  for (const swatch of colorRow.querySelectorAll<HTMLElement>('.ctx-swatch[data-color]')) {
    const on = swatch.dataset.color?.toLowerCase() === current;
    swatch.setAttribute('aria-pressed', String(on));
    preset ||= on;
  }
  customLabel.classList.toggle('selected', !preset);
  customColor.value = current;
}

// The ring opens the browser's own picker, and the menu stays open until the picker is done: 'input' shows each
// colour as it is tried, 'change' keeps the last one (one undo step).
customLabel.addEventListener('click', (e) => e.stopPropagation());
customColor.addEventListener('input', () => setColor(customColor.value));
customColor.addEventListener('change', () => {
  setColor(customColor.value);
  keepBackground();
  hideContextMenus();
});

byId('ctx-bg-add').addEventListener('click', chooseBackgroundPicture);
byId('ctx-bg-adjust').addEventListener('click', startAdjusting);
byId('ctx-bg-remove').addEventListener('click', removePicture);

export function hideContextMenus() {
  byId('context-menu').classList.add('hidden');
  byId('token-context-menu').classList.add('hidden');
  byId('canvas-context-menu').classList.add('hidden');
  closeConditionsMenu();
}

// ── The token menu's Conditions submenu ───────────────────────
// Every condition, ticked if the token has it. A click switches it and the menu stays open, so
// several can be switched in one visit; a click anywhere else closes it with the rest.
const conditionsMenu = byId('token-conditions-menu');
const conditionsRow = byId('ctx-token-conditions');

function closeConditionsMenu(): void {
  conditionsMenu.classList.add('hidden');
  conditionsRow.classList.remove('open');
}

function markConditionsMenu(): void {
  const token = tokenAt(tokenMenuTarget);
  for (const item of conditionsMenu.querySelectorAll<HTMLElement>('.ctx-cond')) {
    item.setAttribute('aria-checked', String(!!token && hasCondition(token, item.dataset.id ?? '')));
  }
}

function openConditionsMenu(): void {
  if (!tokenAt(tokenMenuTarget)) return;
  conditionsMenu.replaceChildren(
    ...allConditions().map((condition) => {
      const item = document.createElement('div');
      item.className = 'ctx-item ctx-cond';
      item.setAttribute('role', 'menuitemcheckbox');
      item.dataset.id = condition.id;
      const name = document.createElement('span');
      name.className = 'ctx-name';
      name.textContent = condition.name;
      const tick = document.createElement('span');
      tick.className = 'ctx-tick';
      tick.textContent = '✓';
      tick.setAttribute('aria-hidden', 'true');
      item.append(conditionBadge(condition, 18), name, tick);
      item.addEventListener('click', (e) => {
        e.stopPropagation(); // the menu stays open
        const token = tokenAt(tokenMenuTarget);
        if (token) toggleCondition(token, condition);
        markConditionsMenu();
      });
      return item;
    }),
  );
  markConditionsMenu();

  // Beside the "Conditions" row, on the left instead if there is no room on the right.
  const row = conditionsRow.getBoundingClientRect();
  conditionsMenu.classList.remove('hidden');
  const { offsetWidth: width, offsetHeight: height } = conditionsMenu;
  const left = row.right + 2 + width > window.innerWidth - 8 ? row.left - width - 2 : row.right + 2;
  conditionsMenu.style.left = `${Math.max(8, left)}px`;
  conditionsMenu.style.top = `${Math.max(8, Math.min(row.top, window.innerHeight - height - 8))}px`;
  conditionsRow.classList.add('open');
}

conditionsRow.addEventListener('click', (e) => {
  e.stopPropagation(); // choosing this row must not close the menu it is in
  if (conditionsMenu.classList.contains('hidden')) openConditionsMenu();
  else closeConditionsMenu();
});
conditionsRow.addEventListener('mouseenter', openConditionsMenu);

iCanvas.addEventListener('contextmenu', onContextMenu);
document.addEventListener('click', hideContextMenus);

// ── Context menu actions (act on the current selection) ───────
byId('ctx-edit-text').addEventListener('click', editSelectedText);
// The lock row locks what is selected, or unlocks the locked element the menu was opened on.
byId('ctx-lock').addEventListener('click', () => {
  if (lockedTarget !== null) lockElements([lockedTarget], false);
  else lockElements(state.selected, true);
});
// The token menu is for the one token it was opened on, whatever else is selected.
byId('ctx-token-lock').addEventListener('click', () => {
  if (tokenMenuTarget !== null) lockElements([tokenMenuTarget], lockedTarget === null);
});
byId('ctx-copy').addEventListener('click', copySelection);

byId('ctx-paste').addEventListener('click', () => {
  if (pasteAnchor) pasteClipboard(pasteAnchor);
});

byId('ctx-delete').addEventListener('click', () => {
  if (state.selected.length) deleteSelected();
});

byId('ctx-bring-front').addEventListener('click', () => {
  if (state.selected.length) bringSelectedToFront();
});

byId('ctx-send-back').addEventListener('click', () => {
  if (state.selected.length) sendSelectedToBack();
});

byId('ctx-duplicate').addEventListener('click', () => {
  if (state.selected.length) duplicateSelected();
});

// Token context menu
byId('ctx-token-delete').addEventListener('click', () => {
  const idx = tokenMenuTarget;
  const token = tokenAt(idx);
  if (idx === null || !token) return;

  showConfirm(token.name ? `Remove token "${token.name}"?` : 'Remove this token?', () => {
    state.elements.splice(idx, 1);
    state.selected = [];
    drawMain();
    pushHistory();
    showUndoToast('Token removed');
  });
});

// Names the token in its card, over the map, rather than in a dialog.
byId('ctx-token-rename').addEventListener('click', () => {
  if (tokenMenuTarget !== null) nameToken(tokenMenuTarget);
});

// The colours are in the token's card, so this selects the token and moves to them.
byId('ctx-token-color').addEventListener('click', () => {
  if (tokenMenuTarget !== null) chooseTokenColor(tokenMenuTarget);
});

// A copy of just this token (numbered on if its name ends in a number), whatever else is selected.
byId('ctx-token-duplicate').addEventListener('click', () => {
  if (tokenMenuTarget === null || !tokenAt(tokenMenuTarget)) return;
  state.selected = [tokenMenuTarget];
  duplicateSelected();
});
