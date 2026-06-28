// ── Realtime collaboration ───────────────────────────────────────
// Each session is a Durable Object room (see party/server.js) keyed by a
// random id carried in the URL (?session=...). Every local
// pushHistory()/undo()/redo() broadcasts the full elements array to the
// room (registered via setHistoryListener — see history.js for why that's
// a callback, not a direct import); an incoming snapshot from a peer
// overwrites local state the same way. This is last-write-wins: edits to
// different elements never collide, but two people editing the *same*
// element at the same instant just have one of them win. No per-action
// merge logic is worth the complexity for a hand-drawn map.
//
// A room is only ever created when the user clicks "Share" — opening the
// app cold never talks to the relay. "Join" lets a user key in another
// session's code (or paste its link) instead of clicking a shared link.
//
// The client side here only ever speaks plain WebSocket (via `partysocket`,
// a reconnecting-WebSocket wrapper) — it has no dependency on PartyKit's
// backend specifically, which is why party/server.js could be swapped from
// a PartyKit-hosted room to a self-deployed Cloudflare Worker + Durable
// Object without any change in this file beyond the default port below.

import PartySocket from 'partysocket';
import { state } from './state.js';
import { applyRemoteSnapshot, setHistoryListener } from './history.js';
import { showToast } from './toast.js';

const RELAY_HOST = import.meta.env.VITE_RELAY_HOST || 'localhost:8787';

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
// current board becomes the room's starting state. Joining an existing
// session must NOT seed — it would race the server's reply with the room's
// actual current state and could stomp it with a stale/empty local board.
function connect(sessionId, { seed = false } = {}) {
  if (socket) socket.close();
  socket = new PartySocket({ host: RELAY_HOST, room: sessionId });
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

function setUrlSessionId(sessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.replaceState(null, '', url);
}

function positionPopover(popover, anchorBtn) {
  popover.classList.remove('hidden');
  const r = anchorBtn.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const left = Math.max(8, Math.min(r.right - pw, window.innerWidth - pw - 8));
  popover.style.left = `${left}px`;
  popover.style.top = `${r.bottom + 8}px`;
}

// ── Share popover ──────────────────────────────────────────────
const shareBtn = document.getElementById('btn-share');
const sharePopover = document.getElementById('share-popover');
const shareCodeInput = document.getElementById('share-code-input');

function hideSharePopover() {
  sharePopover.classList.add('hidden');
}

function openSharePopover() {
  let sessionId = currentUrlSessionId();
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    setUrlSessionId(sessionId);
    connect(sessionId, { seed: true });
  }
  shareCodeInput.value = sessionId;
  hideJoinPopover();
  positionPopover(sharePopover, shareBtn);
}

shareBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (sharePopover.classList.contains('hidden')) openSharePopover();
  else hideSharePopover();
});

shareCodeInput.addEventListener('click', () => shareCodeInput.select());

document.getElementById('share-copy-link').addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href)
    .then(() => showToast('Invite link copied to clipboard'))
    .catch(() => showToast('Could not copy link — copy it from the address bar'));
});

// ── Join popover ───────────────────────────────────────────────
const joinBtn = document.getElementById('btn-join');
const joinPopover = document.getElementById('join-popover');
const joinCodeInput = document.getElementById('join-code-input');

function hideJoinPopover() {
  joinPopover.classList.add('hidden');
}

function openJoinPopover() {
  joinCodeInput.value = '';
  hideSharePopover();
  positionPopover(joinPopover, joinBtn);
  setTimeout(() => joinCodeInput.focus(), 50);
}

joinBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (joinPopover.classList.contains('hidden')) openJoinPopover();
  else hideJoinPopover();
});

// Accepts either a bare session code or a full invite link, so pasting
// either the code itself or the whole shared URL both work.
function extractSessionId(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).searchParams.get('session') || null;
  } catch {
    return trimmed;
  }
}

function joinSession() {
  const sessionId = extractSessionId(joinCodeInput.value);
  if (!sessionId) {
    showToast('Enter a valid session code or link');
    return;
  }
  setUrlSessionId(sessionId);
  connect(sessionId);
  hideJoinPopover();
}

document.getElementById('join-connect-btn').addEventListener('click', joinSession);

joinCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinSession();
  if (e.key === 'Escape') hideJoinPopover();
});

document.addEventListener('click', e => {
  if (!sharePopover.contains(e.target) && e.target !== shareBtn) hideSharePopover();
  if (!joinPopover.contains(e.target) && e.target !== joinBtn) hideJoinPopover();
});

// Loading a shared link still auto-connects (no popover needed) — only a
// manually-entered code goes through the Join popover.
const initialSession = currentUrlSessionId();
if (initialSession) connect(initialSession);
