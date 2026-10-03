// ── Canvas rendering ──────────────────────────────────────────
// Everything that draws to the main canvas (the grid lives in grid.js).
// drawMain() is the one function nearly every interaction handler calls after
// mutating state.

import { state } from './state.js';
import { mainCanvas, mCtx } from './canvas.js';
import { drawGrid } from './grid.js';
import { normalizeRect } from './geometry.js';
import { getElementBounds, drawElementShape } from './elements/index.js';
import { getHandles, hasHandles, HANDLE_RADIUS_PX } from './handles.js';

// Sets the viewport transform and redraws. The one place that keeps the zoom
// readout in sync with state.zoom.
export function setView(panX, panY, zoom = state.zoom) {
  state.panX = panX;
  state.panY = panY;
  state.zoom = zoom;
  document.getElementById('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  drawGrid();
  drawMain();
}

export function drawMain() {
  mCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

  mCtx.save();
  mCtx.translate(state.panX, state.panY);
  mCtx.scale(state.zoom, state.zoom);

  state.elements.forEach((el, idx) => {
    drawElement(mCtx, el, state.selected.includes(idx));
  });

  const handleTarget =
    state.tool === 'select' && state.selected.length === 1
      ? state.elements[state.selected[0]]
      : null;
  const showsHandles = hasHandles(handleTarget);

  if (state.tool === 'select') drawSelectionHighlights(showsHandles ? state.selected[0] : -1);
  if (showsHandles) drawHandles(handleTarget);
  if (state.handleDrag?.kind === 'rotate') drawRotationReadout(handleTarget, state.handleDrag.displayDeg);
  if (state.isBoxSelecting && state.selectBox) drawSelectBox();
  if (state.tool === 'erase' && state.eraseHover) drawEraseHover();
  if (state.preview) drawElement(mCtx, state.preview, false, true);

  mCtx.restore();
}

// ── Highlight boxes ────────────────────────────────────────────
// Sizes ending in Px are screen pixels; drawHighlightBox divides them by zoom
// so the box looks the same at any zoom level.
const SELECTION_STYLE = {
  stroke: 'rgba(80, 160, 255, 0.9)', fill: 'rgba(80, 160, 255, 0.15)',
  padPx: 4, lineWidthPx: 1.5, dashPx: [5, 3],
};
const BOX_SELECT_STYLE = {
  stroke: 'rgba(80, 160, 255, 0.9)', fill: 'rgba(80, 160, 255, 0.12)',
  padPx: 0, lineWidthPx: 1,
};
const ERASE_STYLE = {
  stroke: 'rgba(160, 64, 64, 0.85)', fill: 'rgba(160, 64, 64, 0.18)',
  padPx: 6, lineWidthPx: 1.5, dashPx: [4, 3],
};

// Draws a translucent outlined box around bounds. The padding is the style's
// screen-pixel gap plus half the element's stroke width: the stroke term
// clears the element's own border, and the zoom division keeps the gap from
// shrinking to nothing when zoomed out (which merges the box into a thick
// border).
function drawHighlightBox(bounds, strokeWidth, style) {
  const pad = style.padPx / state.zoom + (strokeWidth || 0) / 2;
  mCtx.save();
  mCtx.strokeStyle = style.stroke;
  mCtx.fillStyle = style.fill;
  mCtx.lineWidth = style.lineWidthPx / state.zoom;
  if (style.dashPx) mCtx.setLineDash(style.dashPx.map(d => d / state.zoom));
  mCtx.beginPath();
  mCtx.rect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
  mCtx.fill();
  mCtx.stroke();
  mCtx.restore();
}

// Box around each selected element. skipIdx is the one element showing
// resize/rotate handles instead (a dashed box around a rotated shape, or a
// circle, looks wrong).
function drawSelectionHighlights(skipIdx) {
  for (const idx of state.selected) {
    if (idx === skipIdx) continue;
    const el = state.elements[idx];
    const bounds = el && getElementBounds(el);
    if (bounds) drawHighlightBox(bounds, el.strokeWidth, SELECTION_STYLE);
  }
}

function drawSelectBox() {
  const { x1, y1, x2, y2 } = state.selectBox;
  drawHighlightBox(normalizeRect(x1, y1, x2, y2), 0, BOX_SELECT_STYLE);
}

// Faded red box around whatever a click with the eraser would remove.
function drawEraseHover() {
  const hover = state.eraseHover;
  if (hover.kind === 'segment') {
    const { x1, y1, x2, y2 } = hover;
    const box = normalizeRect(x1, y1, x2, y2);
    box.w = Math.max(box.w, 1);
    box.h = Math.max(box.h, 1);
    drawHighlightBox(box, hover.strokeWidth, ERASE_STYLE);
    return;
  }
  const el = state.elements[hover.idx];
  const bounds = getElementBounds(el);
  if (bounds) drawHighlightBox(bounds, el.strokeWidth, ERASE_STYLE);
}

export function drawElement(ctx, el, isSelected, isPreview = false) {
  ctx.save();
  ctx.globalAlpha = isPreview ? 0.55 : 1;
  ctx.strokeStyle = el.strokeColor || '#e8dcc8';
  ctx.fillStyle   = el.fillColor   || 'transparent';
  ctx.lineWidth   = el.strokeWidth  || 2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (isSelected) {
    ctx.shadowColor = '#c9a84c';
    ctx.shadowBlur  = 10;
  }

  drawElementShape(ctx, el, isSelected);
  ctx.restore();
}

function drawHandles(el) {
  const handles = getHandles(el);
  const hr = HANDLE_RADIUS_PX / state.zoom;
  const rotateHandle = handles.find(h => h.kind === 'rotate');

  mCtx.save();
  if (rotateHandle) {
    mCtx.strokeStyle = 'rgba(80,160,255,0.6)';
    mCtx.lineWidth = 1 / state.zoom;
    mCtx.beginPath();
    mCtx.moveTo(rotateHandle.from.x, rotateHandle.from.y);
    mCtx.lineTo(rotateHandle.x, rotateHandle.y);
    mCtx.stroke();
  }

  handles.forEach(h => {
    mCtx.beginPath();
    if (h.kind === 'rotate') {
      mCtx.fillStyle = '#50a0ff';
      mCtx.arc(h.x, h.y, hr, 0, Math.PI * 2);
      mCtx.fill();
    } else {
      mCtx.fillStyle = '#fff';
      mCtx.strokeStyle = '#50a0ff';
      mCtx.lineWidth = 1.5 / state.zoom;
      mCtx.rect(h.x - hr, h.y - hr, hr * 2, hr * 2);
      mCtx.fill();
      mCtx.stroke();
    }
  });
  mCtx.restore();
}

function drawRotationReadout(el, deg) {
  const handle = getHandles(el).find(h => h.kind === 'rotate');
  if (!handle) return;
  const label = `${((deg % 360) + 360) % 360}°`;

  mCtx.save();
  mCtx.font = `${12 / state.zoom}px monospace`;
  mCtx.textAlign = 'center';
  mCtx.textBaseline = 'middle';
  const padX = 6 / state.zoom, padY = 4 / state.zoom;
  const w = mCtx.measureText(label).width;
  const lx = handle.x, ly = handle.y - 18 / state.zoom;
  mCtx.fillStyle = 'rgba(26,23,20,0.92)';
  mCtx.fillRect(lx - w / 2 - padX, ly - 7 / state.zoom - padY, w + padX * 2, 14 / state.zoom + padY * 2);
  mCtx.fillStyle = '#c9a84c';
  mCtx.fillText(label, lx, ly);
  mCtx.restore();
}
