// ── Canvas rendering ──────────────────────────────────────────
// Everything that draws to the grid/main canvases. drawMain() is the one
// function nearly every interaction handler calls after mutating state.

import { state, GRID } from './state.js';
import { gridCanvas, mainCanvas, gCtx, mCtx } from './canvas.js';
import { rotatePoint, elementCenter } from './geometry.js';
import { getElementBounds } from './elements.js';
import { getHandles, HANDLE_RADIUS_PX } from './handles.js';

export function drawGrid() {
  const W = gridCanvas.width, H = gridCanvas.height;
  gCtx.clearRect(0, 0, W, H);

  const cellPx = GRID * state.zoom;
  const offsetX = ((state.panX % cellPx) + cellPx) % cellPx;
  const offsetY = ((state.panY % cellPx) + cellPx) % cellPx;

  gCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--dot-color').trim() || 'rgba(180,170,155,0.55)';

  const r = Math.max(1, cellPx * 0.04);

  for (let x = offsetX; x < W + cellPx; x += cellPx) {
    for (let y = offsetY; y < H + cellPx; y += cellPx) {
      gCtx.beginPath();
      gCtx.arc(x, y, r, 0, Math.PI * 2);
      gCtx.fill();
    }
  }
}

export function drawMain() {
  const W = mainCanvas.width, H = mainCanvas.height;
  mCtx.clearRect(0, 0, W, H);

  mCtx.save();
  mCtx.translate(state.panX, state.panY);
  mCtx.scale(state.zoom, state.zoom);

  state.elements.forEach((el, idx) => {
    drawElement(mCtx, el, state.selected.includes(idx));
  });

  const singleHandleTarget =
    state.tool === 'select' && state.selected.length === 1
      ? state.elements[state.selected[0]]
      : null;
  const showsHandles = singleHandleTarget &&
    (singleHandleTarget.type === 'rect' || singleHandleTarget.type === 'wall' || singleHandleTarget.type === 'token');

  // Selection highlight: semi-transparent blue box around each selected
  // element, except the single rect/wall/token that's showing resize/rotate
  // handles instead (a dashed AABB around a rotated shape — or a circle —
  // looks wrong).
  if (state.tool === 'select' && state.selected.length) {
    state.selected.forEach(idx => {
      if (showsHandles && idx === state.selected[0]) return;
      const el = state.elements[idx];
      if (!el) return;
      const bounds = getElementBounds(el);
      if (!bounds) return;
      // Same zoom-correction as the erase-hover highlight below: a fixed
      // world-unit pad shrinks to nothing on screen once zoomed out, letting
      // the dashed line merge back into a thick-stroked element's own border.
      const pad = 4 / state.zoom + (el.strokeWidth || 0) / 2;
      mCtx.save();
      mCtx.strokeStyle = 'rgba(80, 160, 255, 0.9)';
      mCtx.fillStyle   = 'rgba(80, 160, 255, 0.15)';
      mCtx.lineWidth   = 1.5 / state.zoom;
      mCtx.setLineDash([5 / state.zoom, 3 / state.zoom]);
      mCtx.beginPath();
      mCtx.rect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
      mCtx.fill();
      mCtx.stroke();
      mCtx.setLineDash([]);
      mCtx.restore();
    });
  }

  if (showsHandles) drawHandles(singleHandleTarget);

  if (state.handleDrag && state.handleDrag.kind === 'rotate') {
    drawRotationReadout(singleHandleTarget, state.handleDrag.displayDeg);
  }

  // Rubber-band selection box
  if (state.isBoxSelecting && state.selectBox) {
    const { x1, y1, x2, y2 } = state.selectBox;
    const bx = Math.min(x1, x2), by = Math.min(y1, y2);
    const bw = Math.abs(x2 - x1), bh = Math.abs(y2 - y1);
    mCtx.save();
    mCtx.strokeStyle = 'rgba(80, 160, 255, 0.9)';
    mCtx.fillStyle   = 'rgba(80, 160, 255, 0.12)';
    mCtx.lineWidth   = 1 / state.zoom;
    mCtx.beginPath();
    mCtx.rect(bx, by, bw, bh);
    mCtx.fill();
    mCtx.stroke();
    mCtx.restore();
  }

  // Erase hover: faded red outline around whatever the eraser would remove.
  // The pad has to clear the element's own stroke width, or the dashed
  // highlight visually merges into a thick colored border and looks like
  // notches cut out of it instead of an outline wrapping the whole shape.
  // The constant part of the pad is in *screen* pixels (divided by zoom,
  // same as the dashed line's own width/dash pattern below) — a fixed
  // world-unit pad shrinks to nothing on screen once zoomed out, which is
  // exactly what let the highlight merge back into the border before.
  if (state.tool === 'erase' && state.eraseHover) {
    let bx, by, bw, bh;
    if (state.eraseHover.kind === 'segment') {
      const { x1, y1, x2, y2 } = state.eraseHover;
      const pad = 6 / state.zoom + (state.eraseHover.strokeWidth || 0) / 2;
      bx = Math.min(x1, x2) - pad; by = Math.min(y1, y2) - pad;
      bw = Math.max(Math.abs(x2 - x1), 1) + pad * 2; bh = Math.max(Math.abs(y2 - y1), 1) + pad * 2;
    } else {
      const el = state.elements[state.eraseHover.idx];
      const bounds = getElementBounds(el);
      if (bounds) {
        const pad = 6 / state.zoom + (el.strokeWidth || 0) / 2;
        bx = bounds.x - pad; by = bounds.y - pad; bw = bounds.w + pad * 2; bh = bounds.h + pad * 2;
      }
    }
    if (bx !== undefined) {
      mCtx.save();
      mCtx.strokeStyle = 'rgba(160, 64, 64, 0.85)';
      mCtx.fillStyle   = 'rgba(160, 64, 64, 0.18)';
      mCtx.lineWidth   = 1.5 / state.zoom;
      mCtx.setLineDash([4 / state.zoom, 3 / state.zoom]);
      mCtx.strokeRect(bx, by, bw, bh);
      mCtx.fillRect(bx, by, bw, bh);
      mCtx.setLineDash([]);
      mCtx.restore();
    }
  }

  // Preview shape while drawing
  if (state.preview) {
    drawElement(mCtx, state.preview, false, true);
  }

  mCtx.restore();
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
      const r = el.radius || GRID * 0.42; // fallback for tokens saved before variable sizing existed
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
      ctx.font = `bold ${Math.floor(r * 0.85)}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, el.x, el.y + 1);

      // Name below — outlined so it reads on the light canvas background
      if (el.name) {
        ctx.font = `${Math.floor(r * 0.52)}px 'Segoe UI', sans-serif`;
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
      ctx.font = `${(el.fontSize || 14)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = el.strokeColor || '#e8dcc8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (isSelected) {
        const m = ctx.measureText(el.text);
        ctx.save();
        ctx.fillStyle = 'rgba(201,168,76,0.15)';
        ctx.fillRect(el.x - 2, el.y - 2, m.width + 4, (el.fontSize || 14) + 4);
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
