// ── The empty-canvas menu ─────────────────────────────────────
// Paste when something is copied, and the map's background: an image (added, replaced, adjusted or
// removed) and a colour.

import { byId } from '../core/dom';
import type { Point } from '../core/types';
import { clipboard, pasteClipboard } from '../input/selection';
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
import { hideContextMenus, placeMenu } from './menu-kit';

let pasteAnchor: Point | null = null; // the spot to paste at

export function showCanvasContextMenu(cx: number, cy: number, world: Point): void {
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

byId('ctx-paste').addEventListener('click', () => {
  if (pasteAnchor) pasteClipboard(pasteAnchor);
});

// ── The map's background colour ───────────────────────────────
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
