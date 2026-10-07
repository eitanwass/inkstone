// ── A small picture of the map ─────────────────────────────────
// What a map's card in My Maps shows: the map on the board, framed to fit a card (the same 400 by 260 the
// library's sample thumbnails are), as a jpeg data URL. Null for a map with nothing to show. It draws what
// is on the board now, so a map's picture is made as it is put away (ui/maps.ts).

import { state } from '../core/state';
import type { Bounds } from '../core/types';
import { drawBackground, mapColor } from '../draw/grid';
import { drawElement } from '../draw/render';
import { getElementBounds } from '../elements';

const WIDTH = 400;
const HEIGHT = 260;
const MARGIN = 20;
const MAX_ZOOM = 1.5; // a tiny map is not blown up past this
const QUALITY = 0.6;

export function makeThumbnail(): string | null {
  const boxes = state.elements.map(getElementBounds).filter((b): b is Bounds => b !== null);
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  const zoom = Math.min(
    MAX_ZOOM,
    (WIDTH - 2 * MARGIN) / (x2 - x1 || 1),
    (HEIGHT - 2 * MARGIN) / (y2 - y1 || 1),
  );

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = mapColor();
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.translate(WIDTH / 2 - ((x1 + x2) / 2) * zoom, HEIGHT / 2 - ((y1 + y2) / 2) * zoom);
  ctx.scale(zoom, zoom);
  drawBackground(ctx); // behind the elements, as on the screen
  for (const el of state.elements) drawElement(ctx, el, false);
  return canvas.toDataURL('image/jpeg', QUALITY);
}
