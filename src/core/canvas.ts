// ── Canvas element & context references ────────────────────────
// Three-layer stack:
//  grid (background dots)
//  main (committed elements + preview)
//  interaction (transparent, only captures mouse events — nothing is ever drawn to it, so it has no exported context)
// Also the client -> canvas -> world coordinate helpers, since they need the interaction canvas.

import { byId } from './dom';
import { screenToWorld } from './geometry';
import { state } from './state';
import type { Point } from './types';

export const gridCanvas = byId<HTMLCanvasElement>('grid-canvas');
export const mainCanvas = byId<HTMLCanvasElement>('main-canvas');
export const iCanvas = byId<HTMLCanvasElement>('interaction-canvas');

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export const gCtx = context2d(gridCanvas);
export const mCtx = context2d(mainCanvas);

// Browser (client) coordinates -> pixels on the canvas, and on to world space.
export function clientToCanvas(clientX: number, clientY: number): Point {
  const rect = iCanvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// And back: a point in world space -> browser (client) coordinates.
export function worldToClient(x: number, y: number): Point {
  const rect = iCanvas.getBoundingClientRect();
  return { x: rect.left + state.panX + x * state.zoom, y: rect.top + state.panY + y * state.zoom };
}

export function clientToWorld(clientX: number, clientY: number): Point {
  const { x, y } = clientToCanvas(clientX, clientY);
  return screenToWorld(x, y);
}
