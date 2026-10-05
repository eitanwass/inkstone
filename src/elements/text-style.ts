// ── Text style, shared by every element that has text ───────────
// A label's text and a token's name are styled the same way (bold, italic, a background plate) and drawn
// by the same code (text.ts), and so will the text any other element is given later (a door, say): they
// all carry the same optional flags (`TextStyled` in core/types.ts), which are present only when on.
//
// Pure (no DOM), so it is unit tested.

import { FONT_FAMILY } from '../core/state';
import type { TextStyled } from '../core/types';

export const TEXT_STYLE_KEYS = ['bold', 'italic', 'plate'] as const;
export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number];

// The canvas font for text of this size. Inter is a variable font with a weight but no italic face, so
// italics are the browser's slanted version of the upright one.
export const fontString = (size: number, style: TextStyled): string =>
  `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;

// Turns a style flag on or off, leaving it off the element rather than set to false (so an element
// that isn't styled saves, and syncs, exactly as it did before there were styles).
export function setTextStyle(el: TextStyled, key: TextStyleKey, on: boolean): void {
  if (on) el[key] = true;
  else delete el[key];
}

// How far the plate reaches past the text, as a fraction of the text's size.
export const PLATE_PAD = { x: 0.4, y: 0.2 };

const DARK_PLATE = 'rgba(28, 25, 21, 0.86)';
const LIGHT_PLATE = 'rgba(244, 236, 220, 0.9)';

// The plate that makes this text colour readable: a dark one behind light text, a light one behind dark
// text. A colour that isn't #rgb or #rrggbb gets the dark plate.
export function plateColorFor(textColor: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(textColor.trim())?.[1];
  if (!hex) return DARK_PLATE;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? DARK_PLATE : LIGHT_PLATE;
}
