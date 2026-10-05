// ── Dot grid ──────────────────────────────────────────────────
// The background dot grid, drawn live to the grid canvas and reused by PNG
// export so the two can't drift apart.

import { gCtx, gridCanvas } from '../core/canvas';
import { GRID, state } from '../core/state';

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
  const color =
    getComputedStyle(document.documentElement).getPropertyValue('--dot-color').trim() ||
    'rgba(180,170,155,0.55)';
  drawGridDots(gCtx, gridCanvas.width, gridCanvas.height, color);
}
