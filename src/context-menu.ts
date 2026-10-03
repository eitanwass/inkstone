// ── Right-click context menus ─────────────────────────────────
// Three menus: the generic element menu, the token-specific menu (rename/
// recolor don't make sense for a multi-selection), and the empty-canvas
// menu (Paste only, shown when the clipboard has something in it).

import { clientToWorld, iCanvas } from './canvas';
import { openTokenRenameDialog } from './dialogs';
import { byId } from './dom';
import { hitTest } from './elements';
import { pushHistory } from './history';
import { showConfirm } from './modal';
import { drawMain } from './render';
import {
  bringSelectedToFront,
  clipboard,
  copySelection,
  deleteSelected,
  duplicateSelected,
  pasteClipboard,
  sendSelectedToBack,
} from './selection';
import { state } from './state';
import { showToast } from './toast';
import type { Point, TokenElement } from './types';

// What the open menu acts on: the right-clicked token, or the spot to paste at.
let tokenMenuTarget: number | null = null;
let pasteAnchor: Point | null = null;

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

  const world = clientToWorld(clientX, clientY);
  const idx = hitTest(world.x, world.y);

  if (idx !== null && state.elements[idx].type === 'token') {
    showTokenContextMenu(clientX, clientY, idx);
  } else if (idx !== null) {
    if (!state.selected.includes(idx)) state.selected = [idx];
    drawMain();
    showElementContextMenu(clientX, clientY);
  } else if (clipboard.length) {
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

function showElementContextMenu(cx: number, cy: number): void {
  placeMenu(byId('context-menu'), cx, cy);
}

function showTokenContextMenu(cx: number, cy: number, idx: number): void {
  const menu = byId('token-context-menu');
  placeMenu(menu, cx, cy);
  tokenMenuTarget = idx;
}

function showCanvasContextMenu(cx: number, cy: number, world: Point): void {
  const menu = byId('canvas-context-menu');
  placeMenu(menu, cx, cy);
  pasteAnchor = world;
}

export function hideContextMenus() {
  byId('context-menu').classList.add('hidden');
  byId('token-context-menu').classList.add('hidden');
  byId('canvas-context-menu').classList.add('hidden');
}

iCanvas.addEventListener('contextmenu', onContextMenu);
document.addEventListener('click', hideContextMenus);

// ── Context menu actions (act on the current selection) ───────
byId('ctx-copy').addEventListener('click', copySelection);

byId('ctx-paste').addEventListener('click', () => {
  if (pasteAnchor) pasteClipboard(pasteAnchor);
});

byId('ctx-delete').addEventListener('click', () => {
  const n = state.selected.length;
  if (!n) return;
  deleteSelected();
  showToast(n > 1 ? `${n} elements deleted` : 'Element deleted');
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

  const name = token.name || 'this token';
  showConfirm(`Remove token "${name}"?`, () => {
    state.elements.splice(idx, 1);
    state.selected = [];
    drawMain();
    pushHistory();
    showToast('Token removed');
  });
});

byId('ctx-token-rename').addEventListener('click', () => {
  if (tokenMenuTarget !== null) openTokenRenameDialog(tokenMenuTarget);
});

byId('ctx-token-color').addEventListener('click', () => {
  const idx = tokenMenuTarget;
  const token = tokenAt(idx);
  if (!token) return;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = token.color || '#e05c5c';
  picker.click();
  picker.addEventListener('change', () => {
    const current = tokenAt(idx);
    if (!current) return;
    current.color = picker.value;
    drawMain();
    pushHistory();
  });
});
