// ── Canvas element & context references ────────────────────────
// Three-layer stack: grid (background dots), main (committed elements +
// preview), interaction (transparent, only captures mouse events — nothing
// is ever drawn to it, so it has no exported context).

export const gridCanvas = document.getElementById('grid-canvas');
export const mainCanvas = document.getElementById('main-canvas');
export const iCanvas    = document.getElementById('interaction-canvas');

export const gCtx = gridCanvas.getContext('2d');
export const mCtx = mainCanvas.getContext('2d');
