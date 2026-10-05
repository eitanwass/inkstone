// ── Who is connected ───────────────────────────────────────────
// The number beside "Live", and a round identicon for each person under it (right rail). Built from DOM
// nodes, never an HTML string: a name is text someone in the session typed.

import { byId } from '../core/dom';
import { BEZEL_RADIUS, identicon } from '../core/identicon';

const SVG = 'http://www.w3.org/2000/svg';
const MAX_SHOWN = 8; // the rest become a "+N"

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) {
  const made = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  return made;
}

// The sigil on the panels' own dark, with the logo's compass ring (see core/identicon.ts).
function avatar(seed: string, size: number): SVGSVGElement {
  const { color, shade, shapes } = identicon(seed);
  const svg = node('svg', { width: String(size), height: String(size), viewBox: '-10 -10 20 20' });
  svg.append(node('circle', { r: '10', fill: '#1a1714' }));
  svg.append(
    node('circle', {
      r: String(BEZEL_RADIUS),
      fill: 'none',
      stroke: '#a89885',
      'stroke-width': '0.4',
      opacity: '0.7',
    }),
  );
  for (const { d, role } of shapes) {
    const look: Record<string, string> =
      role === 'light'
        ? { fill: color }
        : role === 'dark'
          ? { fill: shade }
          : role === 'line'
            ? { fill: 'none', stroke: color, 'stroke-width': '0.7', 'stroke-linecap': 'round' }
            : { fill: 'none', stroke: '#a89885', 'stroke-width': '0.5', opacity: '0.7' };
    svg.append(node('path', { d, ...look }));
  }
  return svg;
}

const list = byId('people');
let names = new Map<string, string>();

// A connected person's name, if the room has told us (cursors are labelled with it).
export const personName = (id: string): string | undefined => names.get(id);
const count = byId('collab-count');

// Shows `count` people (you first), or nothing when `null` (not connected).
export function showPeople(
  room: { count: number; people: { id: string; name: string }[] } | null,
  selfId: string,
): void {
  list.replaceChildren();
  names = new Map(room?.people.map((p) => [p.id, p.name]));
  count.textContent = room ? `· ${room.count}` : '';
  byId('collab-status').title = room
    ? `${room.count} ${room.count === 1 ? 'person' : 'people'} connected`
    : '';
  if (!room) return;
  const people = [...room.people].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId));
  for (const person of people.slice(0, MAX_SHOWN)) {
    const label = person.id === selfId ? `${person.name} (you)` : person.name;
    const li = document.createElement('li');
    li.className = person.id === selfId ? 'person is-self' : 'person';
    li.title = label;
    li.setAttribute('role', 'img');
    li.setAttribute('aria-label', label);
    li.append(avatar(person.id, 30));
    list.append(li);
  }
  const more = room.count - Math.min(people.length, MAX_SHOWN);
  if (more > 0) {
    const li = document.createElement('li');
    li.className = 'person person-more';
    li.textContent = `+${more}`;
    list.append(li);
  }
}
