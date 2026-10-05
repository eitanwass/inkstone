// ── Realtime collaboration ───────────────────────────────────────
// Each session is a Durable Object room (see party/server.js) keyed by a
// random id carried in the URL (?session=...). Every local
// pushHistory()/undo()/redo() sends the room what changed since the last
// time we and the room agreed (registered via setHistoryListener — see
// history.ts for why that's a callback, not a direct import; the changes
// are in changes.ts, the messages we get back in protocol.ts). Each element
// has an id, so edits to different elements never collide; two people editing
// the *same* element at the same instant just have one of them win.
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
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { BoardElement } from '../core/types';
import { applyRemoteChanges, applyRemoteDocument, setHistoryListener } from '../input/history';
import { refreshMapName } from '../ui/map-name';
import { closePopover, positionPopover } from '../ui/popover';
import { showToast } from '../ui/toast';
import { applyChanges, diff, ensureIds } from './changes';
import { parseMessage } from './protocol';
import { resolveRelayHost } from './relay-host';

// Null in a production build that wasn't given a relay (see relay-host.ts):
// sharing is then unavailable, rather than quietly aimed at localhost.
const RELAY_HOST = resolveRelayHost({
  VITE_RELAY_HOST: import.meta.env.VITE_RELAY_HOST,
  DEV: import.meta.env.DEV,
});

// Lets the page's styles hide anything that promises sharing (the first-visit hint's arrow).
// On <html>, not <body>: setTool() assigns body's whole className.
document.documentElement.classList.toggle('sharing-unavailable', !RELAY_HOST);

const SHARING_UNAVAILABLE = "Sharing isn't set up on this site yet.";

// Whether sharing can be used; if not, tells the user why.
function requireSharing(): boolean {
  if (RELAY_HOST) return true;
  showToast(SHARING_UNAVAILABLE);
  return false;
}

let socket: PartySocket | null = null;

// True when an edit was made while the connection was down, so it never
// reached the room. (PartySocket reconnects by itself; the relay then sends
// its copy of the map and applyRemoteDocument makes that the local map.)
let unsentEdits = false;

// What we believe the room holds: the base each change is measured from. Only set once the room has
// told us (or accepted from us) the whole map, and nothing is sent before then, so a joiner's old
// local map can't leak into a room it has not caught up with.
let synced: { elements: BoardElement[]; name: string } | null = null;

const remember = () => {
  synced = { elements: structuredClone(state.elements), name: state.mapName };
};

function broadcastState() {
  if (!socket) return;
  if (socket.readyState !== WebSocket.OPEN || !synced) {
    unsentEdits = true;
    return;
  }
  ensureIds(state.elements);
  const changes = diff(synced.elements, state.elements, synced.name, state.mapName);
  if (!changes.length) return;
  socket.send(JSON.stringify({ type: 'changes', changes }));
  remember();
}

setHistoryListener(broadcastState);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const STATUS_TEXT = { connecting: 'Connecting…', live: 'Live', reconnecting: 'Reconnecting…' };

function setStatus(status: keyof typeof STATUS_TEXT | null): void {
  const el = byId('collab-status');
  el.classList.toggle('hidden', status === null);
  document.body.classList.toggle('is-sharing', status !== null);
  if (!status) return;
  el.dataset.state = status;
  byId('collab-status-text').textContent = STATUS_TEXT[status];
}

const UNREACHABLE_AFTER_MS = 8000;

// On connecting the relay sends the whole map. A room nobody has used yet (a new one, or one that
// expired) is marked `fresh`, and then our own map becomes the room's; otherwise the room's map is
// the truth and replaces ours, which is also what happens on every reconnect.
function connect(sessionId: string): void {
  if (!RELAY_HOST) return;
  if (socket) socket.close();
  const current = new PartySocket({ host: RELAY_HOST, room: sessionId });
  socket = current;
  synced = null;
  unsentEdits = false;
  let everOpened = false;
  let live = false;
  setStatus('connecting');

  setTimeout(() => {
    if (socket === current && !everOpened) {
      showToast("Can't reach the sharing server yet — still trying…");
    }
  }, UNREACHABLE_AFTER_MS);

  current.addEventListener('open', () => {
    live = true;
    setStatus('live');
    if (!everOpened) {
      showToast('Connected — this map is now shared live');
    } else if (unsentEdits) {
      showToast('Reconnected — changes you made while offline were replaced by the shared map');
    } else {
      showToast('Reconnected');
    }
    everOpened = true;
    unsentEdits = false;
  });
  current.addEventListener('message', (evt) => {
    const message = parseMessage(parseJson(evt.data));
    if (!message) return;
    if (message.type === 'doc') {
      if (message.fresh) {
        ensureIds(state.elements);
        current.send(JSON.stringify({ type: 'doc', name: state.mapName, elements: state.elements }));
      } else {
        applyRemoteDocument(message.name, message.elements);
      }
      remember();
    } else if (synced) {
      applyRemoteChanges(message.changes);
      const rename = message.changes.findLast((c) => c.t === 'name');
      synced = {
        elements: applyChanges(synced.elements, structuredClone(message.changes)),
        name: rename?.t === 'name' ? rename.name : synced.name,
      };
    }
    refreshMapName();
  });
  current.addEventListener('close', () => {
    if (socket !== current || !everOpened) return; // replaced by another session, or never connected
    setStatus('reconnecting');
    // Each failed retry also fires 'close'; only announce the drop once.
    if (live) showToast('Connection lost — reconnecting…');
    live = false;
    synced = null;
  });
}

function currentUrlSessionId() {
  return new URL(window.location.href).searchParams.get('session');
}

function setUrlSessionId(sessionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.replaceState(null, '', url);
}

// ── Share popover ──────────────────────────────────────────────
const shareBtn = byId('btn-share');
const sharePopover = byId('share-popover');
const shareCodeInput = byId<HTMLInputElement>('share-code-input');

function hideSharePopover() {
  closePopover(sharePopover, shareBtn);
}

function openSharePopover() {
  if (!requireSharing()) return;
  let sessionId = currentUrlSessionId();
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    setUrlSessionId(sessionId);
    connect(sessionId);
  }
  shareCodeInput.value = sessionId;
  hideJoinPopover();
  positionPopover(sharePopover, shareBtn);
  shareCodeInput.focus();
}

shareBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (sharePopover.classList.contains('hidden')) openSharePopover();
  else hideSharePopover();
});

shareCodeInput.addEventListener('click', () => shareCodeInput.select());

byId('share-copy-link').addEventListener('click', () => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => showToast('Invite link copied to clipboard'))
    .catch(() => showToast('Could not copy link — copy it from the address bar'));
});

// ── Join popover ───────────────────────────────────────────────
const joinBtn = byId('btn-join');
const joinPopover = byId('join-popover');
const joinCodeInput = byId<HTMLInputElement>('join-code-input');

function hideJoinPopover() {
  closePopover(joinPopover, joinBtn);
}

function openJoinPopover() {
  if (!requireSharing()) return;
  joinCodeInput.value = '';
  hideSharePopover();
  positionPopover(joinPopover, joinBtn);
  setTimeout(() => joinCodeInput.focus(), 50);
}

joinBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (joinPopover.classList.contains('hidden')) openJoinPopover();
  else hideJoinPopover();
});

// Accepts either a bare session code or a full invite link, so pasting
// either the code itself or the whole shared URL both work.
function extractSessionId(input: string): string | null {
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

byId('join-connect-btn').addEventListener('click', joinSession);

joinCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinSession();
  if (e.key === 'Escape') hideJoinPopover();
});

document.addEventListener('click', (e) => {
  if (!sharePopover.contains(e.target as Node) && e.target !== shareBtn) hideSharePopover();
  if (!joinPopover.contains(e.target as Node) && e.target !== joinBtn) hideJoinPopover();
});

// Loading a shared link still auto-connects (no popover needed) — only a
// manually-entered code goes through the Join popover.
const initialSession = currentUrlSessionId();
if (initialSession) {
  if (RELAY_HOST) {
    connect(initialSession);
  } else {
    // Wait a tick past the load handler, whose welcome toast would otherwise
    // replace this one.
    window.addEventListener('load', () =>
      setTimeout(() => showToast(`This link is for a shared map. ${SHARING_UNAVAILABLE}`), 0),
    );
  }
}
