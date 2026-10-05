// ── View & document-level actions ─────────────────────────────
// Reset View button, Clear All, Export PNG.

import { mainCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { parseMapFile, serializeMap } from '../core/map-file';
import { state } from '../core/state';
import { drawGridDots } from '../draw/grid';
import { drawElement, drawMain } from '../draw/render';
import { getImageData, receiveImage } from '../elements/token-image';
import { resetView } from '../input/controls';
import { persistMapName, pushHistory, showUndoToast } from '../input/history';
import { mapFileName, refreshMapName } from './map-name';
import { mapFileSlug, normalizeMapName } from './map-name-text';
import { showConfirm } from './modal';
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

function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

byId('btn-save-file').addEventListener('click', () => {
  const images: Record<string, string> = {};
  for (const el of state.elements) {
    const data = el.type === 'token' && el.image ? getImageData(el.image) : undefined;
    if (data && el.type === 'token' && el.image) images[el.image] = data;
  }
  const text = serializeMap({ name: state.mapName, elements: state.elements, images });
  download(new Blob([text], { type: 'application/json' }), `${mapFileSlug(state.mapName)}.inkstone.json`);
  showToast('Map saved to a file');
});

const fileInput = byId<HTMLInputElement>('open-file-input');
byId('btn-open-file').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = ''; // so choosing the same file again still fires
  if (!file) return;
  const map = parseMapFile(await file.text());
  if (!map) {
    showToast("That isn't an Inkstone map file.");
    return;
  }
  for (const [id, data] of Object.entries(map.images)) receiveImage(id, data);
  state.elements = map.elements;
  state.selected = [];
  state.mapName = normalizeMapName(map.name);
  persistMapName();
  refreshMapName();
  drawMain();
  pushHistory();
  showUndoToast('Map opened');
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
