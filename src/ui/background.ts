// ── The map's background ───────────────────────────────────────
// A colour and/or a picture (a scanned or downloaded map to draw over) behind the grid dots and everything
// else (draw/grid.ts). There is at most one background, an element of type background
// (elements/background.ts) so it is saved, shared and undone with the map, but never pointed at while
// drawing. Both are set from the right-click menu on the map itself (ui/context-menu.ts): "Add image" or
// "Replace image", and a row of colours. A new picture is put straight into *adjusting*: it is then the only
// thing that can be pointed at (elements/layer.ts), and the Adjust image panel (`#adjust-panel`) is shown for
// moving and resizing it, making it fainter, typing how many squares wide it is, replacing or removing it.
//
// Sizing it "to the grid" is by hand for now: drag its corners (to the pixel, with its proportions kept; Shift
// snaps to the grid) or type the width, until its own squares line up with the dots.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { screenToWorld, snapToGrid } from '../core/geometry';
import { GRID, state } from '../core/state';
import type { BackgroundElement } from '../core/types';
import { DEFAULT_MAP_COLOR } from '../draw/grid';
import { drawMain, onMainDrawn } from '../draw/render';
import { backgroundOf } from '../elements/background';
import { addImage, imagesSaved, shrinkPicture } from '../elements/token-image';
import { pushHistory } from '../input/history';
import { setTool } from '../input/toolbar';
import { showToast } from './toast';

const FILL = 0.8; // of the visible map, in each direction, when a picture is first placed
const MIN_OPACITY = 0.05;

// The colours offered in the menu: the default parchment first (which is "no colour chosen"), then lighter and
// darker ones to draw on.
export const MAP_COLORS = [
  { name: 'Parchment', hex: DEFAULT_MAP_COLOR },
  { name: 'Snow', hex: '#f4f3ee' },
  { name: 'Sand', hex: '#d9c9a3' },
  { name: 'Moss', hex: '#a9bda0' },
  { name: 'Sky', hex: '#a9c0d6' },
  { name: 'Stone', hex: '#8d8a84' },
  { name: 'Slate', hex: '#46525e' },
  { name: 'Night', hex: '#1c1f26' },
] as const;

export const background = (): BackgroundElement | undefined => backgroundOf(state.elements);
export const hasPicture = (): boolean => !!background()?.image;

// Where a picture of this size (in pixels) goes: centred in the view, scaled to fit, as many whole cells wide as
// fit.
function placement(width: number, height: number): Pick<BackgroundElement, 'x' | 'y' | 'w' | 'h'> {
  const view = iCanvas.getBoundingClientRect();
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(view.width, view.height);
  const viewW = bottomRight.x - topLeft.x;
  const viewH = bottomRight.y - topLeft.y;
  const fit = Math.min((viewW * FILL) / width, (viewH * FILL) / height);
  const w = Math.max(2 * GRID, Math.round((width * fit) / GRID) * GRID);
  const h = (w * height) / width;
  return {
    x: snapToGrid(topLeft.x + viewW / 2 - w / 2),
    y: snapToGrid(topLeft.y + viewH / 2 - h / 2),
    w,
    h,
  };
}

// The background element, made if the map has none yet.
function ensure(): BackgroundElement {
  let bg = background();
  if (!bg) {
    bg = { type: 'background', x: 0, y: 0, w: 0, h: 0 };
    state.elements.push(bg);
  }
  return bg;
}

// Takes the element away if it has neither a colour nor a picture left.
function dropIfEmpty(): void {
  const bg = background();
  if (bg && !bg.image && !bg.color) state.elements = state.elements.filter((e) => e !== bg);
}

// ── The picture ────────────────────────────────────────────────
const fileInput = byId<HTMLInputElement>('bg-file');

// Opens the file chooser; the picture chosen becomes the background (see `fileInput`'s change below).
export function chooseBackgroundPicture(): void {
  fileInput.click();
}

// Makes the file the map's picture (replacing any, and keeping how faint it was and the colour). False if it can't
// be used as a picture.
async function setPicture(file: File): Promise<boolean> {
  let picture: Awaited<ReturnType<typeof shrinkPicture>>;
  try {
    picture = await shrinkPicture(file);
  } catch {
    showToast("That file can't be used as a picture. Try a PNG, JPEG or WebP.");
    return false;
  }
  const bg = ensure();
  Object.assign(bg, placement(picture.width, picture.height), { image: addImage(picture.data) });
  state.selected = [];
  drawMain();
  pushHistory();
  if (!imagesSaved()) {
    showToast("Picture added, but this browser has no room to keep it, so it won't survive a reload.");
  }
  return true;
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = ''; // so choosing the same file again still fires
  if (file && (await setPicture(file))) startAdjusting(); // straight to sizing it
});

export function removePicture(): void {
  const bg = background();
  if (!bg?.image) return;
  stopAdjusting();
  delete bg.image;
  delete bg.opacity;
  Object.assign(bg, { x: 0, y: 0, w: 0, h: 0 });
  dropIfEmpty();
  state.selected = [];
  drawMain();
  pushHistory();
}

// ── The colour ─────────────────────────────────────────────────
// `hex` null is the default parchment. Shown as it is chosen; `keepBackground` makes it an undo step.
export function setColor(hex: string | null): void {
  if (hex === null || hex.toLowerCase() === DEFAULT_MAP_COLOR) {
    const bg = background();
    if (!bg) return;
    delete bg.color;
    dropIfEmpty();
  } else {
    ensure().color = hex.toLowerCase();
  }
  drawMain();
}

export const currentColor = (): string => background()?.color ?? DEFAULT_MAP_COLOR;

// Records where things stand as one undo step (and tells a session).
export function keepBackground(): void {
  pushHistory();
}

// ── Turning the picture ────────────────────────────────────────
// A quarter turn clockwise (`turns` 1) or back (-1) about the middle of its box, which swaps its width and height.
// Nothing is re-encoded: the box is drawn turned (draw/grid.ts), so turning four times is exactly where it began.
export function rotatePicture(turns: 1 | -1): void {
  const bg = background();
  if (!bg?.image) return;
  const centerX = bg.x + bg.w / 2;
  const centerY = bg.y + bg.h / 2;
  [bg.w, bg.h] = [bg.h, bg.w];
  bg.x = centerX - bg.w / 2;
  bg.y = centerY - bg.h / 2;
  const next = ((((bg.rotation ?? 0) + turns) % 4) + 4) % 4;
  if (next) bg.rotation = next;
  else delete bg.rotation;
  drawMain();
  pushHistory();
}

// ── Opacity and size of the picture ────────────────────────────
// How strongly the picture shows, as it is dragged (`keepBackground` makes the undo step).
function setOpacity(opacity: number): void {
  const bg = background();
  if (!bg?.image) return;
  const clamped = Math.min(1, Math.max(MIN_OPACITY, opacity));
  if (clamped === 1) delete bg.opacity;
  else bg.opacity = clamped;
  drawMain();
}

// Makes the width `squares` cells, keeping its proportions and its top left corner.
function setWidthInSquares(squares: number): boolean {
  const bg = background();
  if (!bg?.image || !Number.isFinite(squares) || squares < 0.5 || squares > 2000) return false;
  const aspect = bg.w / bg.h;
  bg.w = squares * GRID;
  bg.h = bg.w / aspect;
  drawMain();
  return true;
}

// ── Adjusting it on the map ────────────────────────────────────
const panel = byId('adjust-panel');
const opacityInput = byId<HTMLInputElement>('adjust-opacity');
const opacityText = byId('adjust-opacity-text');
const squaresInput = byId<HTMLInputElement>('adjust-squares');
const sizeText = byId('adjust-size');

const round = (n: number, places: number) => String(Math.round(n * 10 ** places) / 10 ** places);

// Brings the panel's controls in line with the picture (a field being typed in is left alone). Also run after
// every redraw, so dragging a corner shows the new width and an undo shows what it undid.
function showValues(): void {
  const bg = background();
  if (!bg?.image || !state.adjustingBackground) return;
  const percent = Math.round((bg.opacity ?? 1) * 100);
  if (document.activeElement !== opacityInput) opacityInput.value = String(percent);
  opacityText.textContent = `${percent}%`;
  if (document.activeElement !== squaresInput) squaresInput.value = round(bg.w / GRID, 2);
  sizeText.textContent = `× ${round(bg.h / GRID, 1)} tall`;
}

export function startAdjusting(): void {
  const index = state.elements.findIndex((e) => e.type === 'background');
  if (index < 0 || !hasPicture()) return;
  setTool('select'); // which also lets go of any other adjusting
  state.adjustingBackground = true;
  state.selected = [index];
  document.documentElement.classList.add('adjusting-background');
  panel.classList.remove('hidden');
  showValues();
  drawMain();
  byId('adjust-done').focus();
}

export function stopAdjusting(): void {
  if (!state.adjustingBackground) return;
  state.adjustingBackground = false;
  state.selected = [];
  document.documentElement.classList.remove('adjusting-background');
  panel.classList.add('hidden');
  drawMain();
}

byId('adjust-done').addEventListener('click', stopAdjusting);
byId('adjust-replace').addEventListener('click', chooseBackgroundPicture);
byId('adjust-remove').addEventListener('click', removePicture);
byId('adjust-rotate-left').addEventListener('click', () => rotatePicture(-1));
byId('adjust-rotate-right').addEventListener('click', () => rotatePicture(1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.adjustingBackground) stopAdjusting();
});

// The slider shows the change as it is dragged, and keeps it (one undo step) when it is let go.
opacityInput.addEventListener('input', () => setOpacity(Number(opacityInput.value) / 100));
opacityInput.addEventListener('change', keepBackground);

// A typed width applies as it is typed, as long as it is a usable one, and is kept (one undo step) when the field
// is left.
let sizeChanged = false;
squaresInput.addEventListener('input', () => {
  const usable = setWidthInSquares(squaresInput.valueAsNumber);
  squaresInput.toggleAttribute('aria-invalid', !usable);
  sizeChanged ||= usable;
});
squaresInput.addEventListener('change', () => {
  squaresInput.removeAttribute('aria-invalid');
  if (sizeChanged) keepBackground();
  sizeChanged = false;
  squaresInput.blur(); // lets the field show the size in use
  showValues();
});

onMainDrawn(showValues);
