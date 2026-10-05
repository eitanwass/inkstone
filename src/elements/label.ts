// ── Text label ────────────────────────────────────────────────

import { mCtx } from '../core/canvas';
import { cellOf } from '../core/geometry';
import { DEFAULT_FONT_SIZE, FONT_FAMILY, state } from '../core/state';
import type { ElementBehavior, LabelElement } from '../core/types';

const DEFAULT_COLOR = '#e8dcc8';

// The colours offered in the label card: the same as the style panel's stroke swatches, so a label can
// be given what the text tool offers (and any colour besides, from the card's colour ring).
export const LABEL_COLORS = [
  { hex: '#e8dcc8', name: 'Parchment' },
  { hex: '#8b5e3c', name: 'Brown' },
  { hex: '#4a7c59', name: 'Forest' },
  { hex: '#5b7fa6', name: 'Water' },
  { hex: '#c9a84c', name: 'Gold' },
  { hex: '#a04040', name: 'Blood' },
] as const;
export const LABEL_SIZE = { min: 8, max: 72 }; // what the card's slider allows, in map units
export const labelColorOf = (el: LabelElement): string => (el.strokeColor || DEFAULT_COLOR).toLowerCase();
export const fontSizeOf = (el: LabelElement) => el.fontSize || DEFAULT_FONT_SIZE;

function textWidth(el: LabelElement): number {
  mCtx.font = `${fontSizeOf(el)}px ${FONT_FAMILY}`;
  return mCtx.measureText(el.text).width;
}

export const label: ElementBehavior<LabelElement> = {
  draw(ctx, el, isSelected) {
    const size = fontSizeOf(el);
    ctx.font = `${size}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (isSelected) {
      ctx.save();
      ctx.fillStyle = 'rgba(201,168,76,0.15)';
      ctx.fillRect(el.x - 2, el.y - 2, ctx.measureText(el.text).width + 4, size + 4);
      ctx.restore();
    }
    if (el === state.editingLabel) return; // the field over it is its text
    ctx.fillStyle = el.strokeColor || DEFAULT_COLOR;
    ctx.fillText(el.text, el.x, el.y);
  },

  bounds(el) {
    return { x: el.x, y: el.y, w: textWidth(el), h: fontSizeOf(el) };
  },

  hit(el, wx, wy) {
    const w = textWidth(el),
      h = fontSizeOf(el);
    return wx >= el.x - 2 && wx <= el.x + w + 2 && wy >= el.y - 2 && wy <= el.y + h + 2;
  },

  // Just the cell the label's anchor point sits in.
  occupiesCell(el, cellX, cellY) {
    return cellOf(el.x) === cellX && cellOf(el.y) === cellY;
  },
};
