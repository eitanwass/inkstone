// ── View & document-level actions ─────────────────────────────
// Reset View button, Clear All, Export PNG.

import { mainCanvas } from './canvas';
import { resetView } from './controls';
import { byId } from './dom';
import { drawGridDots } from './grid';
import { pushHistory, showUndoToast } from './history';
import { mapFileName } from './map-name';
import { showConfirm } from './modal';
import { drawElement, drawMain } from './render';
import { state } from './state';
import { showToast } from './toast';

byId('btn-reset-view').addEventListener('click', resetView);

byId('btn-clear').addEventListener('click', () => {
  showConfirm('Clear all elements from the map?', () => {
    state.elements = [];
    state.selected = [];
    drawMain();
    pushHistory();
    showUndoToast('Map cleared');
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
