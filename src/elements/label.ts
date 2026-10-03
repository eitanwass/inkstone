// ── Text label ────────────────────────────────────────────────

import { DEFAULT_FONT_SIZE, FONT_FAMILY } from '../state';
import { mCtx } from '../canvas';
import { cellOf } from '../geometry';
import type { ElementBehavior, LabelElement } from '../types';

const DEFAULT_COLOR = '#e8dcc8';
const fontSizeOf = (el: LabelElement) => el.fontSize || DEFAULT_FONT_SIZE;

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
    ctx.fillStyle = el.strokeColor || DEFAULT_COLOR;
    ctx.fillText(el.text, el.x, el.y);
  },

  bounds(el) {
    return { x: el.x, y: el.y, w: textWidth(el), h: fontSizeOf(el) };
  },

  hit(el, wx, wy) {
    const w = textWidth(el), h = fontSizeOf(el);
    return wx >= el.x - 2 && wx <= el.x + w + 2 && wy >= el.y - 2 && wy <= el.y + h + 2;
  },

  // Just the cell the label's anchor point sits in.
  occupiesCell(el, cellX, cellY) {
    return cellOf(el.x) === cellX && cellOf(el.y) === cellY;
  },
};
