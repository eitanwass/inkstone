// ── View & document-level actions ─────────────────────────────
// Reset View, Clear All, Export PNG.

import { state, GRID } from './state.js';
import { iCanvas, mainCanvas } from './canvas.js';
import { drawGrid, drawMain, drawElement } from './render.js';
import { pushHistory } from './history.js';
import { showConfirm } from './modal.js';
import { showToast } from './toast.js';

// Single source of truth for the "default" viewport — used both at load and
// by the Reset View button, so the two can never disagree on where "home" is.
export function resetView() {
  state.panX = iCanvas.offsetWidth * 0.1;
  state.panY = iCanvas.offsetHeight * 0.1;
  state.zoom = 1;
  document.getElementById('zoom-label').textContent = '100%';
  drawGrid();
  drawMain();
}

document.getElementById('btn-reset-view').addEventListener('click', resetView);

document.getElementById('btn-clear').addEventListener('click', () => {
  showConfirm('Clear all elements from the map?', () => {
    state.elements = [];
    state.selected = [];
    drawMain();
    pushHistory();
    showToast('Map cleared');
  });
});

document.getElementById('btn-export').addEventListener('click', () => {
  // Render to offscreen canvas at 2x resolution
  const W = mainCanvas.width, H = mainCanvas.height;
  const off = document.createElement('canvas');
  off.width = W * 2; off.height = H * 2;
  const ctx = off.getContext('2d');

  // Background
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(0, 0, off.width, off.height);

  // Grid
  ctx.save();
  ctx.scale(2, 2);
  const cellPx = GRID * state.zoom;
  const offsetX = ((state.panX % cellPx) + cellPx) % cellPx;
  const offsetY = ((state.panY % cellPx) + cellPx) % cellPx;
  ctx.fillStyle = 'rgba(180,170,155,0.45)';
  const r = Math.max(1, cellPx * 0.04);
  for (let x = offsetX; x < W + cellPx; x += cellPx)
    for (let y = offsetY; y < H + cellPx; y += cellPx) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);
  state.elements.forEach(el => drawElement(ctx, el, false));
  ctx.restore();

  off.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dnd-map.png';
    a.click();
  });
  showToast('Map exported!');
});
