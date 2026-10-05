// ── Who is connected ───────────────────────────────────────────
// The number beside "Live", and a round identicon for each player under it (right rail). Built from DOM
// nodes, never an HTML string: a name is text someone in the session typed.

import { byId } from '../core/dom';
import { BEZEL_RADIUS, identicon } from '../core/identicon';
import type { Player } from '../core/player-name';

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

const list = byId('players');
let names = new Map<string, string>();

// A connected player's name, if the room has told us (cursors are labelled with it).
export const playerName = (id: string): string | undefined => names.get(id);
const count = byId('collab-count');

// Shows `count` players (you first), or nothing when `null` (not connected).
export function showPlayers(room: { count: number; players: Player[] } | null, selfId: string): void {
  list.replaceChildren();
  names = new Map(room?.players.map((p) => [p.id, p.name]));
  count.textContent = room ? `· ${room.count}` : '';
  byId('collab-status').title = room
    ? `${room.count} ${room.count === 1 ? 'player' : 'players'} connected`
    : '';
  if (!room) return;
  const players = [...room.players].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId));
  for (const player of players.slice(0, MAX_SHOWN)) {
    const label = player.id === selfId ? `${player.name} (you)` : player.name;
    const li = document.createElement('li');
    li.className = player.id === selfId ? 'player is-self' : 'player';
    li.setAttribute('role', 'img');
    li.setAttribute('aria-label', label);
    li.append(avatar(player.id, 30));
    const tip = document.createElement('span');
    tip.className = 'player-name';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = label;
    li.append(tip);
    list.append(li);
  }
  const more = room.count - Math.min(players.length, MAX_SHOWN);
  if (more > 0) {
    const li = document.createElement('li');
    li.className = 'player player-more';
    li.textContent = `+${more}`;
    list.append(li);
  }
}
