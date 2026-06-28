// ── Right-click context menus ─────────────────────────────────
// Three menus: the generic element menu, the token-specific menu (rename/
// recolor don't make sense for a multi-selection), and the empty-canvas
// menu (Paste only, shown when the clipboard has something in it).

import { state } from './state.js';
import { iCanvas } from './canvas.js';
import { screenToWorld } from './geometry.js';
import { hitTest } from './elements.js';
import { drawMain } from './render.js';
import {
  copySelection, pasteClipboard, deleteSelected, duplicateSelected,
  bringSelectedToFront, sendSelectedToBack, clipboard,
} from './selection.js';
import { pushHistory } from './history.js';
import { showConfirm } from './modal.js';
import { showToast } from './toast.js';

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
export function openContextMenuAt(clientX, clientY) {
  hideContextMenus();

  const rect = iCanvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const world = screenToWorld(sx, sy);

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
function onContextMenu(e) {
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
function placeMenu(menu, cx, cy) {
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
  const { offsetWidth: w, offsetHeight: h } = menu;
  const maxLeft = window.innerWidth - w - 8;
  const maxTop = window.innerHeight - h - 8;
  if (cx > maxLeft) menu.style.left = Math.max(8, maxLeft) + 'px';
  if (cy > maxTop) menu.style.top = Math.max(8, maxTop) + 'px';
}

function showElementContextMenu(cx, cy) {
  placeMenu(document.getElementById('context-menu'), cx, cy);
}

function showTokenContextMenu(cx, cy, idx) {
  const menu = document.getElementById('token-context-menu');
  placeMenu(menu, cx, cy);
  menu._targetIdx = idx;
}

function showCanvasContextMenu(cx, cy, world) {
  const menu = document.getElementById('canvas-context-menu');
  placeMenu(menu, cx, cy);
  menu._pasteAt = world;
}

export function hideContextMenus() {
  document.getElementById('context-menu').classList.add('hidden');
  document.getElementById('token-context-menu').classList.add('hidden');
  document.getElementById('canvas-context-menu').classList.add('hidden');
}

iCanvas.addEventListener('contextmenu', onContextMenu);
document.addEventListener('click', hideContextMenus);

// ── Context menu actions (act on the current selection) ───────
document.getElementById('ctx-copy').addEventListener('click', copySelection);

document.getElementById('ctx-paste').addEventListener('click', () => {
  const menu = document.getElementById('canvas-context-menu');
  if (menu._pasteAt) pasteClipboard(menu._pasteAt);
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  const n = state.selected.length;
  if (!n) return;
  deleteSelected();
  showToast(n > 1 ? `${n} elements deleted` : 'Element deleted');
});

document.getElementById('ctx-bring-front').addEventListener('click', () => {
  if (state.selected.length) bringSelectedToFront();
});

document.getElementById('ctx-send-back').addEventListener('click', () => {
  if (state.selected.length) sendSelectedToBack();
});

document.getElementById('ctx-duplicate').addEventListener('click', () => {
  if (state.selected.length) duplicateSelected();
});

// Token context menu
document.getElementById('ctx-token-delete').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;

  const name = state.elements[idx].name || 'this token';
  showConfirm(`Remove token "${name}"?`, () => {
    state.elements.splice(idx, 1);
    state.selected = [];
    drawMain();
    pushHistory();
    showToast('Token removed');
  });
});

document.getElementById('ctx-token-rename').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;
  const token = state.elements[idx];
  const newName = prompt('Rename token:', token.name || '');
  if (newName !== null) {
    token.name = newName.trim().slice(0, 20) || token.name;
    drawMain();
    pushHistory();
  }
});

document.getElementById('ctx-token-color').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = state.elements[idx].color || '#e05c5c';
  picker.click();
  picker.addEventListener('change', () => {
    state.elements[idx].color = picker.value;
    drawMain();
    pushHistory();
  });
});
