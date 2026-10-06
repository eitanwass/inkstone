// ── Sharing our pointer, and showing theirs ─────────────────────
// A second socket per session, to the cursor relay (party/cursors.js), apart from the one that carries
// the map (collab.ts) so that pointers, which are frequent and worth nothing a moment later, can never
// hold up a change to the map. It is the lower priority one: a position is sent at most every GAP_MS
// (the latest one, so the pointer ends where it stopped), is dropped rather than queued if the socket
// is backed up, and nothing about it is ever shown to anyone as an error. Positions are in world
// units, so they land in the right place whatever each player's pan and zoom.

import PartySocket from 'partysocket';
import { clientToWorld, iCanvas } from '../core/canvas';
import type { Point } from '../core/types';
import { clearCursors, removeCursor, showCursor } from '../ui/cursors';
import { parseCursorMessage } from './protocol';

const GAP_MS = 100; // at most 10 a second: every position sent is a billed request on the free plan
const CURSORS_OFF_CODE = 4503; // the same as in party/server.js
const MAX_BUFFERED = 2048; // bytes waiting to go: past this, positions are dropped

let socket: PartySocket | null = null;
let lastSent = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Point | null = null;

function canSend(sock: PartySocket | null): sock is PartySocket {
  return sock !== null && sock.readyState === WebSocket.OPEN && sock.bufferedAmount < MAX_BUFFERED;
}

function flush(): void {
  timer = undefined;
  if (!pending || !canSend(socket)) return;
  const { x, y } = pending;
  pending = null;
  lastSent = performance.now();
  socket.send(JSON.stringify({ type: 'cursor', x: Math.round(x), y: Math.round(y) }));
}

iCanvas.addEventListener('pointermove', (e) => {
  if (!socket) return;
  pending = clientToWorld(e.clientX, e.clientY);
  const wait = GAP_MS - (performance.now() - lastSent);
  if (wait <= 0) flush();
  else timer ??= setTimeout(flush, wait);
});

iCanvas.addEventListener('pointerleave', () => {
  pending = null;
  clearTimeout(timer);
  timer = undefined;
  if (canSend(socket)) socket.send('{"type":"hide"}');
});

// Joins the session's cursors (leaving any earlier one). `cid` is this tab and `id` this player, the
// same as in the map's hello.
export function connectCursors(host: string, room: string, cid: string, id: string): void {
  disconnectCursors();
  const current = new PartySocket({ host, basePath: `cursors/${room}` });
  socket = current;
  current.addEventListener('open', () => current.send(JSON.stringify({ type: 'hello', cid, id })));
  current.addEventListener('message', (evt) => {
    let data: unknown = null;
    try {
      data = JSON.parse(evt.data);
    } catch {
      // not ours to show
    }
    const message = parseCursorMessage(data);
    if (message?.type === 'cursor') showCursor(message.cid, message.id, message.x, message.y);
    else if (message) removeCursor(message.cid);
  });
  // Pointers we were shown may have gone while we were away; those still here are sent again.
  current.addEventListener('close', (evt) => {
    if (socket === current) clearCursors();
    // The relay has cursors switched off (to stay inside the free plan): stop trying, rather than ask again
    // every few seconds, which would cost the very requests it is saving.
    if (evt.code === CURSORS_OFF_CODE) current.close();
  });
}

export function disconnectCursors(): void {
  socket?.close();
  socket = null;
  clearTimeout(timer);
  timer = undefined;
  pending = null;
  clearCursors();
}
