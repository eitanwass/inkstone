// ── Drawing text on the map ─────────────────────────────────────
// One place that draws and measures an element's text, so a label and a token's name are styled alike
// (bold, italic, a background plate: see text-style.ts) and so will the text of any element that is given
// some later. An element's own file says where its text goes and what it looks like by default; this
// does the rest.

import { mCtx } from '../core/canvas';
import type { Bounds, TextStyled } from '../core/types';
import { fontString, PLATE_PAD, plateColorFor } from './text-style';

export interface TextSpec {
  text: string;
  x: number; // the anchor: where the text is, as `align` and `baseline` say
  y: number;
  size: number; // in map units
  color: string;
  style: TextStyled;
  align: 'left' | 'center';
  baseline: 'top' | 'middle';
  outline?: boolean; // a dark edge so it reads on any background, for text that has no plate
}

export function textWidth(text: string, size: number, style: TextStyled): number {
  mCtx.font = fontString(size, style);
  return mCtx.measureText(text).width;
}

// The text's own box.
export function textRect(spec: TextSpec): Bounds {
  const w = textWidth(spec.text, spec.size, spec.style);
  return {
    x: spec.align === 'center' ? spec.x - w / 2 : spec.x,
    y: spec.baseline === 'middle' ? spec.y - spec.size / 2 : spec.y,
    w,
    h: spec.size,
  };
}

// What the text covers: its box, and the plate around it if it has one.
export function plateRect(spec: TextSpec): Bounds {
  const box = textRect(spec);
  if (!spec.style.plate) return box;
  const padX = spec.size * PLATE_PAD.x;
  const padY = spec.size * PLATE_PAD.y;
  return { x: box.x - padX, y: box.y - padY, w: box.w + 2 * padX, h: box.h + 2 * padY };
}

export function drawText(ctx: CanvasRenderingContext2D, spec: TextSpec): void {
  ctx.save();
  ctx.font = fontString(spec.size, spec.style);
  ctx.textAlign = spec.align;
  ctx.textBaseline = spec.baseline;
  if (spec.style.plate) {
    const { x, y, w, h } = plateRect(spec);
    ctx.fillStyle = plateColorFor(spec.color);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, spec.size * 0.3);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  } else if (spec.outline) {
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(spec.text, spec.x, spec.y);
  }
  ctx.fillStyle = spec.color;
  ctx.fillText(spec.text, spec.x, spec.y);
  ctx.restore();
}
