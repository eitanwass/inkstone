// ── Text label ────────────────────────────────────────────────

import { cellOf } from '../core/geometry';
import { DEFAULT_FONT_SIZE, state } from '../core/state';
import type { ElementBehavior, LabelElement } from '../core/types';
import { drawText, plateRect, type TextSpec } from './text';

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

// Where a label's text goes: its top left corner is the label's x, y, so the text stays put when a plate is
// switched on (the plate reaches out around it).
const specOf = (el: LabelElement): TextSpec => ({
  text: el.text,
  x: el.x,
  y: el.y,
  size: fontSizeOf(el),
  color: el.strokeColor || DEFAULT_COLOR,
  style: el,
  align: 'left',
  baseline: 'top',
});

export const label: ElementBehavior<LabelElement> = {
  draw(ctx, el, isSelected) {
    const spec = specOf(el);
    if (isSelected) {
      const { x, y, w, h } = plateRect(spec);
      ctx.save();
      ctx.fillStyle = 'rgba(201,168,76,0.15)';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.restore();
    }
    if (el === state.editingLabel) return; // the field over it is its text
    drawText(ctx, spec);
  },

  bounds(el) {
    return plateRect(specOf(el));
  },

  hit(el, wx, wy) {
    const { x, y, w, h } = plateRect(specOf(el));
    return wx >= x - 2 && wx <= x + w + 2 && wy >= y - 2 && wy <= y + h + 2;
  },

  // Just the cell the label's anchor point sits in.
  occupiesCell(el, cellX, cellY) {
    return cellOf(el.x) === cellX && cellOf(el.y) === cellY;
  },
};
