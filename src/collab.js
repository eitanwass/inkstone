// ── Realtime collaboration ───────────────────────────────────────
// Each session is a PartyKit room keyed by a random id carried in the URL
// (?session=...). Every local pushHistory()/undo()/redo() broadcasts the
// full elements array to the room (registered via setHistoryListener — see
// history.js for why that's a callback, not a direct import); an incoming
// snapshot from a peer overwrites local state the same way. This is last-
// write-wins: edits to different elements never collide, but two people
// editing the *same* element at the same instant just have one of them win.
// No per-action merge logic is worth the complexity for a hand-drawn map.

import PartySocket from 'partysocket';
import { state } from './state.js';
import { applyRemoteSnapshot, setHistoryListener } from './history.js';
import { showToast } from './toast.js';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

let socket = null;

function broadcastState() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(state.elements));
}

setHistoryListener(broadcastState);

function setStatus(connected) {
  document.getElementById('collab-status').classList.toggle('hidden', !connected);
}

// `seed` is only true when *creating* a brand-new session: that client's
// current board becomes the room's starting state. A client joining an
// existing session must NOT seed — it would race the server's reply with
// the room's actual current state and could stomp it with a stale/empty
// local board.
function connect(sessionId, { seed = false } = {}) {
  socket = new PartySocket({ host: PARTYKIT_HOST, room: sessionId });
  socket.addEventListener('open', () => {
    setStatus(true);
    showToast('Connected — this map is now shared live');
    if (seed) broadcastState();
  });
  socket.addEventListener('message', (evt) => {
    applyRemoteSnapshot(JSON.parse(evt.data));
  });
  socket.addEventListener('close', () => setStatus(false));
}

function currentUrlSessionId() {
  return new URL(window.location.href).searchParams.get('session');
}

document.getElementById('btn-share').addEventListener('click', () => {
  let sessionId = currentUrlSessionId();
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.replaceState(null, '', url);
    connect(sessionId, { seed: true });
  }
  navigator.clipboard.writeText(window.location.href)
    .then(() => showToast('Invite link copied to clipboard'))
    .catch(() => showToast('Could not copy link — copy it from the address bar'));
});

const initialSession = currentUrlSessionId();
if (initialSession) connect(initialSession);
