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

function onContextMenu(e) {
  e.preventDefault();
  hideContextMenus();

  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  const idx = hitTest(world.x, world.y);

  if (idx !== null && state.elements[idx].type === 'token') {
    showTokenContextMenu(e.clientX, e.clientY, idx);
  } else if (idx !== null) {
    if (!state.selected.includes(idx)) state.selected = [idx];
    drawMain();
    showElementContextMenu(e.clientX, e.clientY);
  } else if (clipboard.length) {
    showCanvasContextMenu(e.clientX, e.clientY, world);
  }
}

function showElementContextMenu(cx, cy) {
  const menu = document.getElementById('context-menu');
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
}

function showTokenContextMenu(cx, cy, idx) {
  const menu = document.getElementById('token-context-menu');
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
  menu._targetIdx = idx;
}

function showCanvasContextMenu(cx, cy, world) {
  const menu = document.getElementById('canvas-context-menu');
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
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
