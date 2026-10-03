// ── Canvas rendering ──────────────────────────────────────────
// Everything that draws to the main canvas (the grid lives in grid.js).
// drawMain() is the one function nearly every interaction handler calls after
// mutating state.

import { mainCanvas, mCtx } from './canvas';
import { byId } from './dom';
import { drawElementShape, getElementBounds, getElementDimensions } from './elements';
import { normalizeRect } from './geometry';
import { drawGrid } from './grid';
import { getHandles, HANDLE_RADIUS_PX, hasHandles } from './handles';
import { updateFirstVisitHint } from './hint';
import { formatDistance, gridDistance } from './measure';
import { state } from './state';
import type { BoardElement, Bounds, Dimension, Ruler } from './types';

// Sets the viewport transform and redraws. The one place that keeps the zoom
// readout in sync with state.zoom.
export function setView(panX: number, panY: number, zoom: number = state.zoom): void {
  state.panX = panX;
  state.panY = panY;
  state.zoom = zoom;
  byId('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
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
    state.tool === 'select' && state.selected.length === 1 ? state.elements[state.selected[0]] : null;
  const showsHandles = hasHandles(handleTarget);

  if (state.tool === 'select') drawSelectionHighlights(showsHandles ? state.selected[0] : -1);
  if (showsHandles) drawHandles(handleTarget);
  if (showsHandles && state.handleDrag?.kind === 'rotate') {
    drawRotationReadout(handleTarget, state.handleDrag.displayDeg ?? 0);
  }
  if (state.isBoxSelecting && state.selectBox) drawSelectBox();
  if (state.tool === 'erase' && state.eraseHover) drawEraseHover();
  if (state.preview) drawElement(mCtx, state.preview, false, true);

  // How big the shape being drawn or resized is. (A rotate drag has its own readout.)
  const sized =
    state.preview ?? (state.handleDrag && state.handleDrag.kind !== 'rotate' ? handleTarget : null);
  const sizeText = sized ? drawDimensions(sized) : null;
  const rulerText = state.ruler ? drawRuler(state.ruler) : null;
  byId('measure-readout').textContent = rulerText ?? sizeText ?? '';

  mCtx.restore();
  updateFirstVisitHint();
}

// ── Highlight boxes ────────────────────────────────────────────
// Sizes ending in Px are screen pixels; drawHighlightBox divides them by zoom
// so the box looks the same at any zoom level.
interface HighlightStyle {
  stroke: string;
  fill: string;
  padPx: number;
  lineWidthPx: number;
  dashPx?: number[];
}

const SELECTION_STYLE: HighlightStyle = {
  stroke: 'rgba(80, 160, 255, 0.9)',
  fill: 'rgba(80, 160, 255, 0.15)',
  padPx: 4,
  lineWidthPx: 1.5,
  dashPx: [5, 3],
};
const BOX_SELECT_STYLE: HighlightStyle = {
  stroke: 'rgba(80, 160, 255, 0.9)',
  fill: 'rgba(80, 160, 255, 0.12)',
  padPx: 0,
  lineWidthPx: 1,
};
const ERASE_STYLE: HighlightStyle = {
  stroke: 'rgba(160, 64, 64, 0.85)',
  fill: 'rgba(160, 64, 64, 0.18)',
  padPx: 6,
  lineWidthPx: 1.5,
  dashPx: [4, 3],
};

// Draws a translucent outlined box around bounds. The padding is the style's
// screen-pixel gap plus half the element's stroke width: the stroke term
// clears the element's own border, and the zoom division keeps the gap from
// shrinking to nothing when zoomed out (which merges the box into a thick
// border).
function drawHighlightBox(bounds: Bounds, strokeWidth: number | undefined, style: HighlightStyle): void {
  const pad = style.padPx / state.zoom + (strokeWidth || 0) / 2;
  mCtx.save();
  mCtx.strokeStyle = style.stroke;
  mCtx.fillStyle = style.fill;
  mCtx.lineWidth = style.lineWidthPx / state.zoom;
  if (style.dashPx) mCtx.setLineDash(style.dashPx.map((d) => d / state.zoom));
  mCtx.beginPath();
  mCtx.rect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
  mCtx.fill();
  mCtx.stroke();
  mCtx.restore();
}

// Box around each selected element. skipIdx is the one element showing
// resize/rotate handles instead (a dashed box around a rotated shape, or a
// circle, looks wrong).
function drawSelectionHighlights(skipIdx: number): void {
  for (const idx of state.selected) {
    if (idx === skipIdx) continue;
    const el = state.elements[idx];
    const bounds = el && getElementBounds(el);
    if (bounds) drawHighlightBox(bounds, el.strokeWidth, SELECTION_STYLE);
  }
}

function drawSelectBox(): void {
  if (!state.selectBox) return;
  const { x1, y1, x2, y2 } = state.selectBox;
  drawHighlightBox(normalizeRect(x1, y1, x2, y2), 0, BOX_SELECT_STYLE);
}

// Faded red box around whatever a click with the eraser would remove.
function drawEraseHover(): void {
  const hover = state.eraseHover;
  if (!hover) return;
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

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: BoardElement,
  isSelected: boolean,
  isPreview = false,
): void {
  ctx.save();
  ctx.globalAlpha = isPreview ? 0.55 : 1;
  ctx.strokeStyle = el.strokeColor || '#e8dcc8';
  ctx.fillStyle = el.fillColor || 'transparent';
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isSelected) {
    ctx.shadowColor = '#c9a84c';
    ctx.shadowBlur = 10;
  }

  drawElementShape(ctx, el, isSelected);
  ctx.restore();
}

function drawHandles(el: BoardElement): void {
  const handles = getHandles(el);
  const hr = HANDLE_RADIUS_PX / state.zoom;
  const rotateHandle = handles.find((h) => h.kind === 'rotate');

  mCtx.save();
  if (rotateHandle?.from) {
    mCtx.strokeStyle = 'rgba(80,160,255,0.6)';
    mCtx.lineWidth = 1 / state.zoom;
    mCtx.beginPath();
    mCtx.moveTo(rotateHandle.from.x, rotateHandle.from.y);
    mCtx.lineTo(rotateHandle.x, rotateHandle.y);
    mCtx.stroke();
  }

  handles.forEach((h) => {
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

function drawRotationReadout(el: BoardElement, deg: number): void {
  const handle = getHandles(el).find((h) => h.kind === 'rotate');
  if (!handle) return;
  drawReadout(`${((deg % 360) + 360) % 360}°`, handle.x, handle.y - 18 / state.zoom);
}

// A small dark pill with gold text, centred on (x, y) and the same size on screen at any zoom.
function drawReadout(text: string, x: number, y: number): void {
  mCtx.save();
  mCtx.font = `${12 / state.zoom}px monospace`;
  mCtx.textAlign = 'center';
  mCtx.textBaseline = 'middle';
  const padX = 6 / state.zoom,
    padY = 4 / state.zoom;
  const w = mCtx.measureText(text).width;
  mCtx.fillStyle = 'rgba(26,23,20,0.92)';
  mCtx.fillRect(x - w / 2 - padX, y - 7 / state.zoom - padY, w + padX * 2, 14 / state.zoom + padY * 2);
  mCtx.fillStyle = '#c9a84c';
  mCtx.fillText(text, x, y);
  mCtx.restore();
}

// How much of the screen's bottom the tool dock and style panel can cover.
const BOTTOM_PANELS_PX = 150;
// How far a dimension's ruler sits off the shape, and how long its end ticks are (screen pixels).
const DIMENSION_GAP_PX = 16;
const DIMENSION_TICK_PX = 5;

// A ruler along each stretch of the shape worth measuring (a room's width and its height, a
// wall's length). Returns what they say ("30 ft × 20 ft") for the hidden readout, or null.
function drawDimensions(el: BoardElement): string | null {
  const dimensions = getElementDimensions(el);
  if (!dimensions.length) return null;
  for (const d of dimensions) drawDimension(d);
  return dimensions.map((d) => d.text).join(' × ');
}

// One ruler: a line beside the edge with a tick at each end, the length in a pill on it, and
// pale halo under the dark line like the ruler tool's. It goes to the shape's other side
// when its usual one is under the tool dock and style panel.
function drawDimension(d: Dimension): void {
  const gap = DIMENSION_GAP_PX / state.zoom;
  const tick = DIMENSION_TICK_PX / state.zoom;
  let { x: ox, y: oy } = d.offset;
  const lineY = (d.from.y + d.to.y) / 2 + oy * gap;
  if (oy > 0 && lineY * state.zoom + state.panY > mainCanvas.height - BOTTOM_PANELS_PX) {
    ox = -ox;
    oy = -oy;
  }
  const a = { x: d.from.x + ox * gap, y: d.from.y + oy * gap };
  const b = { x: d.to.x + ox * gap, y: d.to.y + oy * gap };

  mCtx.save();
  mCtx.lineCap = 'round';
  for (const [color, width] of [
    ['rgba(233,228,218,0.9)', 4.5],
    ['#4a3f2e', 1.8],
  ] as const) {
    mCtx.strokeStyle = color;
    mCtx.lineWidth = width / state.zoom;
    mCtx.beginPath();
    mCtx.moveTo(a.x, a.y);
    mCtx.lineTo(b.x, b.y);
    for (const p of [a, b]) {
      mCtx.moveTo(p.x - ox * tick, p.y - oy * tick);
      mCtx.lineTo(p.x + ox * tick, p.y + oy * tick);
    }
    mCtx.stroke();
  }
  mCtx.restore();
  drawReadout(d.text, (a.x + b.x) / 2, (a.y + b.y) / 2);
}

// The ruler's line, end dots and length. A pale halo under the dark line keeps it readable on
// both the parchment and the dark rooms.
function drawRuler(r: Ruler): string {
  mCtx.save();
  mCtx.lineCap = 'round';
  for (const [color, width] of [
    ['rgba(233,228,218,0.9)', 6],
    ['#4a3f2e', 2.5],
  ] as const) {
    mCtx.strokeStyle = color;
    mCtx.lineWidth = width / state.zoom;
    mCtx.beginPath();
    mCtx.moveTo(r.x1, r.y1);
    mCtx.lineTo(r.x2, r.y2);
    mCtx.stroke();
  }
  for (const [x, y] of [
    [r.x1, r.y1],
    [r.x2, r.y2],
  ]) {
    mCtx.beginPath();
    mCtx.arc(x, y, 4.5 / state.zoom, 0, Math.PI * 2);
    mCtx.fillStyle = '#4a3f2e';
    mCtx.fill();
    mCtx.lineWidth = 1.5 / state.zoom;
    mCtx.strokeStyle = 'rgba(233,228,218,0.9)';
    mCtx.stroke();
  }
  mCtx.restore();
  const text = formatDistance(gridDistance(r.x2 - r.x1, r.y2 - r.y1));
  drawReadout(text, (r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2 - 20 / state.zoom);
  return text;
}
