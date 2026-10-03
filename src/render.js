// ── Canvas rendering ──────────────────────────────────────────
// Everything that draws to the main canvas (the grid lives in grid.js).
// drawMain() is the one function nearly every interaction handler calls after
// mutating state.

import { state, DEFAULT_TOKEN_RADIUS, DEFAULT_FONT_SIZE, FONT_FAMILY } from './state.js';
import { mainCanvas, mCtx } from './canvas.js';
import { drawGrid } from './grid.js';
import { rotatePoint, elementCenter, normalizeRect } from './geometry.js';
import { getElementBounds } from './elements.js';
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

  switch (el.type) {
    case 'rect': {
      const { x, y, w, h } = el;
      const rotation = el.rotation || 0;
      if (rotation) {
        const cx = x + w / 2, cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.translate(-cx, -cy);
      }
      if (el.fillColor && el.fillColor !== 'transparent') {
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'wall': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    }
    case 'token': {
      const r = el.radius || DEFAULT_TOKEN_RADIUS;
      // Shadow ring
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.fillStyle = el.color || '#e05c5c';
      ctx.fill();
      ctx.restore();

      // Rim
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = lighten(el.color || '#e05c5c', 60);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Initials
      const label = el.name ? el.name.slice(0, 2).toUpperCase() : '?';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(r * 0.85)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, el.x, el.y + 1);

      // Name below — outlined so it reads on the light canvas background
      if (el.name) {
        ctx.font = `${Math.floor(r * 0.52)}px ${FONT_FAMILY}`;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(el.name, el.x, el.y + r + 10);
        ctx.fillStyle = '#fff';
        ctx.fillText(el.name, el.x, el.y + r + 10);
      }
      break;
    }
    case 'label': {
      ctx.font = `${(el.fontSize || DEFAULT_FONT_SIZE)}px ${FONT_FAMILY}`;
      ctx.fillStyle = el.strokeColor || '#e8dcc8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (isSelected) {
        const m = ctx.measureText(el.text);
        ctx.save();
        ctx.fillStyle = 'rgba(201,168,76,0.15)';
        ctx.fillRect(el.x - 2, el.y - 2, m.width + 4, (el.fontSize || DEFAULT_FONT_SIZE) + 4);
        ctx.restore();
        ctx.fillStyle = el.strokeColor || '#e8dcc8';
      }
      ctx.fillText(el.text, el.x, el.y);
      break;
    }
  }
  ctx.restore();
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function drawHandles(el) {
  const handles = getHandles(el);
  const hr = HANDLE_RADIUS_PX / state.zoom;
  const rotateHandle = handles.find(h => h.kind === 'rotate');
  const center = elementCenter(el);

  mCtx.save();
  if (rotateHandle) {
    mCtx.strokeStyle = 'rgba(80,160,255,0.6)';
    mCtx.lineWidth = 1 / state.zoom;
    mCtx.beginPath();
    if (el.type === 'rect') {
      const rotation = el.rotation || 0;
      const topMid = rotatePoint({ x: center.x, y: el.y }, center, rotation);
      mCtx.moveTo(topMid.x, topMid.y);
    } else {
      mCtx.moveTo(center.x, center.y);
    }
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
