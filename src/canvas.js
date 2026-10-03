// ── Canvas element & context references ────────────────────────
// Three-layer stack: grid (background dots), main (committed elements +
// preview), interaction (transparent, only captures mouse events — nothing
// is ever drawn to it, so it has no exported context). Also the client ->
// canvas -> world coordinate helpers, since they need the interaction canvas.

import { screenToWorld } from './geometry.js';

export const gridCanvas = document.getElementById('grid-canvas');
export const mainCanvas = document.getElementById('main-canvas');
export const iCanvas    = document.getElementById('interaction-canvas');

export const gCtx = gridCanvas.getContext('2d');
export const mCtx = mainCanvas.getContext('2d');

// Browser (client) coordinates -> pixels on the canvas, and on to world space.
export function clientToCanvas(clientX, clientY) {
  const rect = iCanvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function clientToWorld(clientX, clientY) {
  const { x, y } = clientToCanvas(clientX, clientY);
  return screenToWorld(x, y);
}
