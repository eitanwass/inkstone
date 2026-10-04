// ── Condition badges on a token ────────────────────────────────
// Each condition is a small round badge on the top of the token's rim: its color, its icon in white
// (the same path the page draws in the card and menus), a dark ring so it reads on parchment and on
// the dark rooms alike. Three fit; a fourth turns the last into a count ("+2"). Zoomed far out they
// would be unreadable specks, so they fold into one gold dot. A dead token is the exception: it is
// greyed and crossed out instead of badged (see crossOut).

import { type Condition, DEAD_ID, ICONS } from '../conditions';
import { FONT_FAMILY } from '../state';
import type { TokenElement } from '../types';

const SHOWN = 3;
const FOLD_BELOW_ZOOM = 0.55;
const GOLD = '#c9a84c';
const RING = '#1e1b17';

const paths = new Map<string, Path2D>();
function pathFor(icon: string): Path2D {
  let path = paths.get(icon);
  if (!path) {
    path = new Path2D(ICONS[icon].d);
    paths.set(icon, path);
  }
  return path;
}

export const isDead = (el: TokenElement): boolean => !!el.conditions?.some((c) => c.id === DEAD_ID);

// One badge, centred on (cx, cy). `zoom` keeps its outline a steady width on screen.
function chip(
  ctx: CanvasRenderingContext2D,
  c: Condition,
  cx: number,
  cy: number,
  radius: number,
  zoom: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = c.color;
  ctx.fill();
  ctx.lineWidth = 1.6 / zoom;
  ctx.strokeStyle = RING;
  ctx.stroke();

  const size = radius * 1.3;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const dash = ICONS[c.icon].dash;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(pathFor(c.icon));
  ctx.restore();
}

// "+2": how many more there are than fit.
function count(
  ctx: CanvasRenderingContext2D,
  n: number,
  cx: number,
  cy: number,
  radius: number,
  zoom: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2a2520';
  ctx.fill();
  ctx.lineWidth = 1.4 / zoom;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.fillStyle = '#e8dcc8';
  ctx.font = `700 ${radius * 1.05}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${n}`, cx, cy + radius * 0.05);
  ctx.restore();
}

// The badges for a token of radius r (world units), at the current zoom.
export function drawBadges(ctx: CanvasRenderingContext2D, el: TokenElement, r: number, zoom: number): void {
  const list = el.conditions ?? [];
  if (!list.length) return;

  if (zoom < FOLD_BELOW_ZOOM) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(el.x, el.y - r, 4.5 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.lineWidth = 1.4 / zoom;
    ctx.strokeStyle = RING;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // A steady size on screen, whatever the zoom, within sensible limits for the token's size.
  const radius = Math.min(13, Math.max(6, r * zoom * 0.4)) / zoom;
  const slots = Math.min(list.length, SHOWN);
  const step = (radius * 2.15) / r; // radians between centres, so neighbours just touch
  for (let i = 0; i < slots; i++) {
    const angle = -Math.PI / 2 + (i - (slots - 1) / 2) * step;
    const cx = el.x + Math.cos(angle) * r;
    const cy = el.y + Math.sin(angle) * r;
    if (list.length > SHOWN && i === SHOWN - 1) count(ctx, list.length - (SHOWN - 1), cx, cy, radius, zoom);
    else chip(ctx, list[i], cx, cy, radius, zoom);
  }
}

// A dead token: a dark red cross over it.
export function crossOut(ctx: CanvasRenderingContext2D, el: TokenElement, r: number): void {
  const reach = r * 0.62;
  ctx.save();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = Math.max(3, r * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(el.x - reach, el.y - reach);
  ctx.lineTo(el.x + reach, el.y + reach);
  ctx.moveTo(el.x + reach, el.y - reach);
  ctx.lineTo(el.x - reach, el.y + reach);
  ctx.stroke();
  ctx.restore();
}
