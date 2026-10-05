// ── Realtime collaboration ───────────────────────────────────────
// Each session is a Durable Object room (see party/server.js) keyed by a
// random id carried in the URL (?session=...). Every local
// pushHistory()/undo()/redo() sends the room what changed since the last
// time we and the room agreed (registered via setHistoryListener — see
// history.ts for why that's a callback, not a direct import; the changes
// are in changes.ts, the messages we get back in protocol.ts). Each element
// has an id, so edits to different elements never collide. The room is the
// source of truth: it numbers every accepted batch of changes (a revision),
// and refuses a change to something someone else changed after the revision
// we built on; it then sends us its version, so we settle on the same map.
// After a drop, we say the last revision we have and are sent what changed;
// our own offline edits are sent on top, and refused where they conflict.
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
import { storageGet, storageSet } from '../core/storage';
import type { BoardElement } from '../core/types';
import { getImageData, receiveImage } from '../elements/token-image';
import { applyRemoteChanges, applyRemoteDocument, setHistoryListener } from '../input/history';
import { refreshMapName } from '../ui/map-name';
import { showPeople } from '../ui/people';
import { closePopover, positionPopover } from '../ui/popover';
import { showToast } from '../ui/toast';
import { applyChanges, type Change, diff, ensureIds, ID_RE } from './changes';
import { type Message, parseMessage } from './protocol';
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

// This tab (new on each page load; the relay doesn't count a client's own earlier batches as
// conflicts) and the person, kept in this browser so the room's log can say who changed what. The
// name is a placeholder until it can be edited.
const clientId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const AUTHOR_KEY = 'inkstone-author';

function loadAuthor(): { id: string; name: string } {
  const saved = parseJson(storageGet(AUTHOR_KEY) ?? '') as { id?: unknown; name?: unknown } | null;
  if (
    typeof saved?.id === 'string' &&
    ID_RE.test(saved.id) &&
    typeof saved.name === 'string' &&
    saved.name.length <= 40
  ) {
    return { id: saved.id, name: saved.name };
  }
  const author = {
    id: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
    name: `Guest ${1000 + Math.floor(Math.random() * 9000)}`,
  };
  storageSet(AUTHOR_KEY, JSON.stringify(author));
  return author;
}
const author = loadAuthor();

// True when an edit was made while we couldn't send it (the connection was down, or the room had
// not yet told us where it stands). It is sent once we are caught up, as part of the difference
// between the map and `synced`.
let unsentEdits = false;

// What we believe the room holds: the base each change is measured from. Only set once the room has
// told us (or accepted from us) the whole map, so a joiner's old local map can't leak into a room it
// has not caught up with.
let synced: { elements: BoardElement[]; name: string } | null = null;

// Which life of the room and which revision `synced` is at.
let room = { epoch: '', rev: 0 };

// Whether the room has answered our hello on this connection. Nothing is sent before it has, since
// the room ignores a client it has not met, and what we sent would count as sent.
let caughtUp = false;

// Pictures are not part of the map: a token holds the id of one, and each picture goes over the wire
// once, as its own message. `uploadedImages` are the ones the room has from us (so moving a token never
// sends its picture again), `requestedImages` the ones we have asked the room for.
const uploadedImages = new Set<string>();
const requestedImages = new Set<string>();

const imageIds = (elements: BoardElement[]): string[] =>
  elements.flatMap((el) => (el.type === 'token' && el.image ? [el.image] : []));

// Sends the room the pictures these elements use, if it hasn't had them from us.
function uploadImages(sock: PartySocket, elements: BoardElement[]): void {
  for (const id of imageIds(elements)) {
    const data = getImageData(id);
    if (data && !uploadedImages.has(id)) {
      sock.send(JSON.stringify({ type: 'image', id, data }));
      uploadedImages.add(id);
    }
  }
}

// Asks the room for the pictures the map uses that we don't have (a token that came from someone else).
function requestMissingImages(sock: PartySocket): void {
  const ids = [...new Set(imageIds(state.elements))].filter(
    (id) => !getImageData(id) && !requestedImages.has(id),
  );
  for (let i = 0; i < ids.length; i += 50) {
    sock.send(JSON.stringify({ type: 'getimages', ids: ids.slice(i, i + 50) }));
  }
  for (const id of ids) requestedImages.add(id);
}

const remember = () => {
  synced = { elements: structuredClone(state.elements), name: state.mapName };
};

function broadcastState() {
  if (!socket) return;
  if (socket.readyState !== WebSocket.OPEN || !synced || !caughtUp) {
    unsentEdits = true;
    return;
  }
  ensureIds(state.elements);
  const changes = diff(synced.elements, state.elements, synced.name, state.mapName);
  if (!changes.length) return;
  uploadImages(
    socket,
    changes.flatMap((c) => (c.t === 'set' ? [c.el] : [])),
  );
  socket.send(JSON.stringify({ type: 'changes', base: room.rev, changes }));
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

function sendHello(sock: PartySocket): void {
  const since = synced && room.epoch ? { epoch: room.epoch, since: room.rev } : {};
  sock.send(JSON.stringify({ type: 'hello', cid: clientId, author, ...since }));
}

// Applies changes that came from the room to the map and to what we know the room holds.
function applyFromRoom(changes: Change[]): void {
  if (!synced) return;
  applyRemoteChanges(changes);
  const rename = changes.findLast((c) => c.t === 'name');
  synced = {
    elements: applyChanges(synced.elements, structuredClone(changes)),
    name: rename?.t === 'name' ? rename.name : synced.name,
  };
}

function onMessage(sock: PartySocket, message: Message): void {
  switch (message.type) {
    case 'doc': {
      const wasInRoom = synced !== null;
      if (message.fresh) {
        // A room nobody has used yet (a new one, or one that expired): our map becomes the room's.
        ensureIds(state.elements);
        uploadedImages.clear();
        uploadImages(sock, state.elements);
        sock.send(JSON.stringify({ type: 'doc', name: state.mapName, elements: state.elements }));
        remember();
        room = { epoch: '', rev: 0 }; // the ack brings the epoch
      } else {
        // Nothing to be caught up from (a first visit, or the room's log doesn't reach back to our
        // last revision): the room's map replaces ours.
        if (wasInRoom && unsentEdits) {
          showToast('Reconnected — changes you made while offline were replaced by the shared map');
        }
        if (message.epoch !== room.epoch) uploadedImages.clear(); // a new life of the room has none of ours
        applyRemoteDocument(message.name, message.elements);
        remember();
        room = { epoch: message.epoch, rev: message.rev };
      }
      caughtUp = true;
      unsentEdits = false;
      break;
    }
    case 'catchup': {
      if (!synced) return;
      // What we changed while away (measured before the room's changes arrive), then the room's
      // changes, which win; ours go on top and are refused where they conflict.
      ensureIds(state.elements);
      const ours = diff(synced.elements, state.elements, synced.name, state.mapName);
      const base = room.rev;
      applyFromRoom(message.changes);
      room = { epoch: message.epoch, rev: message.rev };
      caughtUp = true;
      unsentEdits = false;
      if (ours.length) {
        uploadImages(
          sock,
          ours.flatMap((c) => (c.t === 'set' ? [c.el] : [])),
        );
        sock.send(JSON.stringify({ type: 'changes', base, changes: ours }));
        remember();
        showToast('Reconnected — your changes while offline were added to the shared map');
      }
      break;
    }
    case 'changes':
      if (!synced || !caughtUp) return;
      if (message.rev !== room.rev + 1) {
        // One went missing: ask to be caught up.
        caughtUp = false;
        sendHello(sock);
        return;
      }
      applyFromRoom(message.changes);
      room.rev = message.rev;
      break;
    case 'ack':
      if (!synced) return;
      room = { epoch: message.epoch || room.epoch, rev: message.rev };
      if (message.fix.length) {
        applyFromRoom(message.fix);
        showToast('Someone else changed that first, so their version was kept');
      }
      break;
    case 'presence':
      showPeople(message, author.id);
      return;
    case 'image':
      requestedImages.delete(message.id);
      receiveImage(message.id, message.data);
      return;
  }
  requestMissingImages(sock);
  refreshMapName();
}

// On connecting we say hello (who we are and, if we have been here before, the last revision we
// have) and the room answers with what we need: the whole map, or just what changed since.
function connect(sessionId: string): void {
  if (!RELAY_HOST) return;
  if (socket) socket.close();
  const current = new PartySocket({ host: RELAY_HOST, room: sessionId });
  socket = current;
  synced = null;
  room = { epoch: '', rev: 0 };
  caughtUp = false;
  unsentEdits = false;
  showPeople(null, author.id);
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
    showToast(everOpened ? 'Reconnected' : 'Connected — this map is now shared live');
    everOpened = true;
    caughtUp = false;
    requestedImages.clear(); // a request made on the old connection may never have arrived
    sendHello(current);
  });
  current.addEventListener('message', (evt) => {
    const message = parseMessage(parseJson(evt.data));
    if (message) onMessage(current, message);
  });
  current.addEventListener('close', () => {
    if (socket !== current || !everOpened) return; // replaced by another session, or never connected
    setStatus('reconnecting');
    showPeople(null, author.id); // the room tells us again once we are back
    // Each failed retry also fires 'close'; only announce the drop once.
    if (live) showToast('Connection lost — reconnecting…');
    live = false;
    caughtUp = false;
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
