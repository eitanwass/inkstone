// ── View & document-level actions ─────────────────────────────
// Reset View, Clear All, Export PNG.

import { iCanvas, mainCanvas } from './canvas';
import { byId } from './dom';
import { drawGridDots } from './grid';
import { pushHistory } from './history';
import { mapFileName } from './map-name';
import { showConfirm } from './modal';
import { drawElement, drawMain, setView } from './render';
import { state } from './state';
import { showToast } from './toast';

// Single source of truth for the "default" viewport — used both at load and
// by the Reset View button, so the two can never disagree on where "home" is.
export function resetView() {
  setView(iCanvas.offsetWidth * 0.1, iCanvas.offsetHeight * 0.1, 1);
}

byId('btn-reset-view').addEventListener('click', resetView);

byId('btn-clear').addEventListener('click', () => {
  showConfirm('Clear all elements from the map?', () => {
    state.elements = [];
    state.selected = [];
    drawMain();
    pushHistory();
    showToast('Map cleared');
  });
});

byId('btn-export').addEventListener('click', () => {
  // Render to offscreen canvas at 2x resolution
  const W = mainCanvas.width,
    H = mainCanvas.height;
  const off = document.createElement('canvas');
  off.width = W * 2;
  off.height = H * 2;
  const ctx = off.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(0, 0, off.width, off.height);

  // Grid
  ctx.save();
  ctx.scale(2, 2);
  drawGridDots(ctx, W, H, 'rgba(180,170,155,0.45)');
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);
  for (const el of state.elements) drawElement(ctx, el, false);
  ctx.restore();

  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = mapFileName();
    a.click();
  });
  showToast('Map exported!');
});
