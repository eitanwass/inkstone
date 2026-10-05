// ── Token ─────────────────────────────────────────────────────
// A circle at x,y with a variable radius and a name. Boards saved before
// variable sizing have no radius, so every reader falls back to
// DEFAULT_TOKEN_RADIUS.

import { mCtx } from '../core/canvas';
import { dist } from '../core/geometry';
import { formatDistance } from '../core/measure';
import { DEFAULT_TOKEN_RADIUS, FONT_FAMILY, GRID, state } from '../core/state';
import type { ElementBehavior, TokenElement } from '../core/types';
import { crossOut, drawBadges, isDead } from './badges';

const DEFAULT_COLOR = '#e05c5c';
const DEAD_COLOR = '#8b857a'; // a dead token is drawn grey, whatever color it had

// The colours a token comes in. New tokens take them in turn, so a handful placed one after
// another can be told apart, and the token card offers them as swatches.
export const PALETTE = [
  { hex: '#e05c5c', name: 'Red' },
  { hex: '#5c8ae0', name: 'Blue' },
  { hex: '#5cba6a', name: 'Green' },
  { hex: '#e0a85c', name: 'Orange' },
  { hex: '#9a5ce0', name: 'Purple' },
  { hex: '#5ce0d4', name: 'Teal' },
  { hex: '#e05caa', name: 'Pink' },
  { hex: '#c8e05c', name: 'Lime' },
] as const;
let placedCount = 0;

export function nextTokenColor(): string {
  return PALETTE[placedCount++ % PALETTE.length].hex;
}

const radiusOf = (el: TokenElement) => el.radius || DEFAULT_TOKEN_RADIUS;
const nameFontSize = (r: number) => Math.floor(r * 0.52);

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

export const token: ElementBehavior<TokenElement> = {
  // Its width, in whole squares (Medium is one square, 5 ft; Large two, and so on), as a ruler
  // above it: the name is written below.
  dimensions(el) {
    const r = radiusOf(el);
    return [
      {
        from: { x: el.x - r, y: el.y - r },
        to: { x: el.x + r, y: el.y - r },
        text: formatDistance(Math.max(1, Math.round((r * 2) / GRID))),
        offset: { x: 0, y: -1 },
      },
    ];
  },

  draw(ctx, el) {
    const r = radiusOf(el);
    const dead = isDead(el);
    const color = dead ? DEAD_COLOR : el.color || DEFAULT_COLOR;

    // Shadow ring
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Rim
    ctx.beginPath();
    ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = lighten(color, 60);
    ctx.lineWidth = 2;
    ctx.stroke();

    // A token with no name is a plain disc: no initials, no label.
    if (el.name) {
      // Initials
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(r * 0.85)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.name.slice(0, 2).toUpperCase(), el.x, el.y + 1);

      // Name below — outlined so it reads on the light canvas background
      ctx.font = `${nameFontSize(r)}px ${FONT_FAMILY}`;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(el.name, el.x, el.y + r + 10);
      ctx.fillStyle = '#fff';
      ctx.fillText(el.name, el.x, el.y + r + 10);
    }

    // Dead is crossed out; anything else it is under shows as badges.
    if (dead) crossOut(ctx, el, r);
    else drawBadges(ctx, el, r, state.zoom);
  },

  bounds(el) {
    const drawR = radiusOf(el);
    const r = drawR + 2; // small pad beyond the visible circle
    if (!el.name) return { x: el.x - r, y: el.y - r, w: r * 2, h: r * 2 };
    // Include the name label drawn below the token.
    const fontSize = nameFontSize(drawR);
    mCtx.font = `${fontSize}px ${FONT_FAMILY}`;
    const halfW = Math.max(r, mCtx.measureText(el.name).width / 2);
    const bottom = el.y + drawR + 10 + fontSize;
    return { x: el.x - halfW, y: el.y - r, w: halfW * 2, h: bottom - (el.y - r) };
  },

  hit(el, wx, wy) {
    return dist(wx, wy, el.x, el.y) < radiusOf(el) + 4;
  },

  // Overlap with the cell's box rather than "is the center in this cell", so
  // a large token erases from any cell it visually covers.
  occupiesCell(el, cellX, cellY) {
    const r = radiusOf(el);
    return cellX < el.x + r && cellX + GRID > el.x - r && cellY < el.y + r && cellY + GRID > el.y - r;
  },

  // One handle at the SE edge (45°, matching the rect SE corner). Radius is
  // the only degree of freedom, and rotating a circle is a no-op, so there's
  // no rotate handle.
  handles(el) {
    const r = radiusOf(el);
    const a = Math.PI / 4;
    return [{ id: 'se', kind: 'resize-radius', x: el.x + r * Math.cos(a), y: el.y + r * Math.sin(a) }];
  },
};
