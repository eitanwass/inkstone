// ── The map's name ─────────────────────────────────────────────
// Shown top-centre as a title that reads like text and turns into a text field
// when clicked. Pressing Enter or clicking away commits the new name; Escape
// puts the old one back. A commit is saved and sent to collaborators once, not
// per keystroke, and is not an undo step (renaming and undoing don't interact).

import { byId } from './dom';
import { broadcastDocument, loadPersistedMapName, persistMapName } from './history';
import { mapFileSlug, normalizeMapName } from './map-name-text';
import { state } from './state';

const input = byId<HTMLInputElement>('map-name');
const mirror = byId('map-title-mirror');

// The input can't size itself to its text, so a hidden copy of the text sits in
// the same grid cell and gives the box its width.
function renderMirror(): void {
  mirror.textContent = input.value || input.placeholder;
}

function renderPageTitle(): void {
  document.title = state.mapName ? `${state.mapName} – Inkstone` : 'Inkstone';
}

// Shows state.mapName: in the field, in the tab title. Called at startup and
// whenever the name may have changed under us (a collaborator renamed the map).
// It never touches the field while someone is typing in it, so an incoming
// message can't eat their half-written name; it's shown when they finish.
export function refreshMapName(): void {
  if (document.activeElement !== input) input.value = state.mapName;
  renderMirror();
  renderPageTitle();
}

// The name for an exported PNG, e.g. "the-sunken-crypt.png".
export function mapFileName(): string {
  return `${mapFileSlug(state.mapName)}.png`;
}

// Who wants to know when the user commits a new name (collab keeps the invite
// link's ?map= in step with it). Only real changes are announced.
const committedListeners: Array<() => void> = [];
export function onMapNameCommitted(listener: () => void): void {
  committedListeners.push(listener);
}

function commit(): void {
  const name = normalizeMapName(input.value);
  input.value = name; // show it as it was kept (trimmed, tidied)
  if (name !== state.mapName) {
    state.mapName = name;
    persistMapName();
    broadcastDocument();
    for (const listener of committedListeners) listener();
  }
  renderMirror();
  renderPageTitle();
}

input.addEventListener('input', renderMirror);
input.addEventListener('blur', commit);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    input.blur(); // which commits
  } else if (e.key === 'Escape') {
    input.value = state.mapName; // put the old name back, then leave
    input.blur();
  }
});

state.mapName = loadPersistedMapName();
refreshMapName();
