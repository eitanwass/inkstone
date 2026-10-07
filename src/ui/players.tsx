// ── Who is connected ───────────────────────────────────────────
// The number beside "Live", and a round identicon for each player under it (right rail). Drawn by Preact
// into the two elements the right rail's markup has for them (`#players`, `#collab-count`), again each
// time the room says who is there (`showPlayers`): they are plain functions of that list, so no state of
// their own.

import { render } from 'preact';
import { byId } from '../core/dom';
import { BEZEL_RADIUS, identicon } from '../core/identicon';
import type { Player } from '../core/player-name';

const MAX_SHOWN = 8; // the rest become a "+N"

type Room = { count: number; players: Player[] };

// The sigil on the panels' own dark, with the logo's compass ring (see core/identicon.ts).
function Avatar({ seed, size }: { seed: string; size: number }) {
  const { color, shade, shapes } = identicon(seed);
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <circle r="10" fill="#1a1714" />
      <circle r={BEZEL_RADIUS} fill="none" stroke="#a89885" stroke-width="0.4" opacity="0.7" />
      {shapes.map(({ d, role }) =>
        role === 'light' ? (
          <path d={d} fill={color} />
        ) : role === 'dark' ? (
          <path d={d} fill={shade} />
        ) : role === 'line' ? (
          <path d={d} fill="none" stroke={color} stroke-width="0.7" stroke-linecap="round" />
        ) : (
          <path d={d} fill="none" stroke="#a89885" stroke-width="0.5" opacity="0.7" />
        ),
      )}
    </svg>
  );
}

function PlayerList({ room, selfId }: { room: Room; selfId: string }) {
  const players = [...room.players].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId));
  const shown = players.slice(0, MAX_SHOWN);
  const more = room.count - shown.length;
  return (
    <>
      {shown.map((player) => {
        const self = player.id === selfId;
        const label = self ? `${player.name} (you)` : player.name;
        return (
          <li class={self ? 'player is-self' : 'player'} role="img" aria-label={label} key={player.id}>
            <Avatar seed={player.id} size={30} />
            <span class="player-name" aria-hidden="true">
              {label}
            </span>
          </li>
        );
      })}
      {more > 0 && <li class="player player-more">{`+${more}`}</li>}
    </>
  );
}

const list = byId('players');
const count = byId('collab-count');
let names = new Map<string, string>();

// A connected player's name, if the room has told us (cursors are labelled with it).
export const playerName = (id: string): string | undefined => names.get(id);

// Shows the players in `room` (you first), or nothing when `null` (not connected).
export function showPlayers(room: Room | null, selfId: string): void {
  names = new Map(room?.players.map((p) => [p.id, p.name]));
  byId('collab-status').title = room
    ? `${room.count} ${room.count === 1 ? 'player' : 'players'} connected`
    : '';
  render(room ? <PlayerList room={room} selfId={selfId} /> : null, list);
  render(room ? `· ${room.count}` : null, count);
}
