// ── Other people's pointers ────────────────────────────────────
// One small arrow in the person's colour (their sigil's, see core/identicon.ts) with their name, for
// each cursor the cursor relay reports (collab/cursors.ts). They are DOM elements over the map rather
// than canvas drawing, so a moving pointer never redraws the map, and CSS glides each one between the
// positions it is sent. A pointer is kept in world units and placed again after every redraw
// (render.ts's onMainDrawn hook), so it stays on its spot as the map is panned or zoomed.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { identicon } from '../core/identicon';
import { state } from '../core/state';
import { onMainDrawn } from '../draw/render';
import { personName } from './people';

const SVG = 'http://www.w3.org/2000/svg';
const layer = byId('cursors');

type Cursor = { el: HTMLElement; name: HTMLElement; x: number; y: number };
const cursors = new Map<string, Cursor>(); // by tab

function place({ el, x, y }: Cursor): void {
  const screen = iCanvas.getBoundingClientRect();
  const left = screen.left + state.panX + x * state.zoom;
  const top = screen.top + state.panY + y * state.zoom;
  el.style.transform = `translate(${left}px, ${top}px)`;
}

function create(id: string): Cursor {
  const el = document.createElement('div');
  el.className = 'cursor';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 12 17');
  const arrow = document.createElementNS(SVG, 'path');
  arrow.setAttribute('d', 'M.8.8v13l3.4-3.2 2.6 5.6 2.2-1-2.6-5.5h4.6z');
  arrow.setAttribute('fill', identicon(id).color);
  arrow.setAttribute('stroke', '#1a1714');
  arrow.setAttribute('stroke-width', '1.2');
  arrow.setAttribute('stroke-linejoin', 'round');
  svg.append(arrow);
  const name = document.createElement('span');
  name.className = 'cursor-name';
  el.append(svg, name);
  layer.append(el);
  return { el, name, x: 0, y: 0 };
}

// Puts (or moves) a person's pointer at a point in the map.
export function showCursor(cid: string, id: string, x: number, y: number): void {
  let cursor = cursors.get(cid);
  const isNew = !cursor;
  if (!cursor) {
    cursor = create(id);
    cursors.set(cid, cursor);
  }
  cursor.x = x;
  cursor.y = y;
  const name = personName(id) ?? '';
  if (cursor.name.textContent !== name) cursor.name.textContent = name;
  place(cursor);
  const { el } = cursor;
  if (isNew) requestAnimationFrame(() => el.classList.add('glide'));
}

export function removeCursor(cid: string): void {
  cursors.get(cid)?.el.remove();
  cursors.delete(cid);
}

export function clearCursors(): void {
  for (const cid of [...cursors.keys()]) removeCursor(cid);
}

onMainDrawn(() => {
  for (const cursor of cursors.values()) place(cursor);
});
