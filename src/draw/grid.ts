// ── Dot grid, and the picture behind it ───────────────────────
// The background dot grid, drawn live to the grid canvas and reused by PNG
// export so the two can't drift apart. The map's background picture (elements/image.ts) is drawn on the
// same layer, first, so it is behind the dots and behind everything on the map.

import { gCtx, gridCanvas } from '../core/canvas';
import { GRID, state } from '../core/state';
import { backgroundOf } from '../elements/background';
import { imageFor } from '../elements/token-image';

// The map's colour when none has been chosen (parchment, --canvas-bg in the stylesheet).
export const DEFAULT_MAP_COLOR = '#e9e4da';

export const mapColor = (): string => backgroundOf(state.elements)?.color ?? DEFAULT_MAP_COLOR;

// How light a #rrggbb colour looks, from 0 to 1 (the usual weights for the three channels).
function lightness(hex: string): number {
  const channel = (i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

// The dots: `usual` on the default parchment or any light colour, light dots on a dark one so they still show.
export function dotColorFor(color: string, usual: string): string {
  return lightness(color) < 0.4 ? 'rgba(232, 220, 200, 0.3)' : usual;
}

// The map's colour over a whole width x height area, if one has been chosen (the default is the page's own).
export function fillMapColor(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const color = backgroundOf(state.elements)?.color;
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

// The background picture, in world coordinates: ctx must already have the pan and zoom applied.
export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const bg = backgroundOf(state.elements);
  const picture = bg?.image ? imageFor(bg.image) : null;
  if (!bg || !picture) return;
  ctx.save();
  ctx.globalAlpha = bg.opacity ?? 1;
  // Turned about the middle of its box; on a quarter or three quarters turn the picture's own width runs
  // along the box's height.
  const turns = bg.rotation ?? 0;
  const [w, h] = turns % 2 ? [bg.h, bg.w] : [bg.w, bg.h];
  ctx.translate(bg.x + bg.w / 2, bg.y + bg.h / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(picture, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// What the grid layer shows of the background, as text: when it changes (a colour or picture was added,
// moved, resized, made fainter, or has just finished loading) the layer needs drawing again, which the pan
// and zoom alone would never ask for. Asked by drawMain.
let shownBackground = '';
export function redrawGridIfBackgroundChanged(): void {
  const bg = backgroundOf(state.elements);
  const key = bg
    ? `${bg.color ?? ''}|${bg.image ?? ''}|${bg.x}|${bg.y}|${bg.w}|${bg.h}|${bg.opacity ?? 1}|${bg.rotation ?? 0}|${bg.image && imageFor(bg.image) ? 1 : 0}`
    : '';
  if (key === shownBackground) return;
  shownBackground = key;
  drawGrid();
}

// Fills a width x height area of ctx with one dot per grid intersection,
// following the current pan/zoom.
export function drawGridDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
): void {
  const cellPx = GRID * state.zoom;
  const offsetX = ((state.panX % cellPx) + cellPx) % cellPx;
  const offsetY = ((state.panY % cellPx) + cellPx) % cellPx;
  const radius = Math.max(1, cellPx * 0.04);

  ctx.fillStyle = color;
  for (let x = offsetX; x < width + cellPx; x += cellPx) {
    for (let y = offsetY; y < height + cellPx; y += cellPx) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawGrid() {
  gCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  fillMapColor(gCtx, gridCanvas.width, gridCanvas.height);
  gCtx.save();
  gCtx.translate(state.panX, state.panY);
  gCtx.scale(state.zoom, state.zoom);
  drawBackground(gCtx);
  gCtx.restore();
  const color =
    getComputedStyle(document.documentElement).getPropertyValue('--dot-color').trim() ||
    'rgba(180,170,155,0.55)';
  drawGridDots(gCtx, gridCanvas.width, gridCanvas.height, dotColorFor(mapColor(), color));
}
