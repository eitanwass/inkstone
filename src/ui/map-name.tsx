// ── The map's name ─────────────────────────────────────────────
// Shown top-centre as a title that reads like text and turns into a text field
// when clicked. Pressing Enter or clicking away commits the new name; Escape
// puts the old one back. A commit is saved and sent to other players once, not
// per keystroke, and is not an undo step (renaming and undoing don't interact).
//
// It is a Preact component (see library.tsx), drawn into #map-title. The map's name is `state.mapName`;
// the field shows what is being typed while it has the focus, and the name otherwise.

import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { byId } from '../core/dom';
import { state } from '../core/state';
import { broadcastDocument, loadPersistedMapName, persistMapName } from '../input/history';
import { mapFileSlug, normalizeMapName } from './map-name-text';
import { useEditorRedraw } from './use-editor';

const PLACEHOLDER = 'Untitled map';

function renderPageTitle(): void {
  document.title = state.mapName ? `${state.mapName} – Inkstone` : 'Inkstone';
}

// Asks for the field to be drawn again; set by the component.
let redraw = () => {};

// Shows state.mapName: in the field, in the tab title. Called at startup and
// whenever the name may have changed under us (someone else renamed the map).
// It never touches the field while someone is typing in it, so an incoming
// message can't eat their half-written name; it's shown when they finish.
export function refreshMapName(): void {
  renderPageTitle();
  redraw();
}

// The name for an exported PNG, e.g. "the-sunken-crypt.png".
export function mapFileName(): string {
  return `${mapFileSlug(state.mapName)}.png`;
}

function MapName() {
  redraw = useEditorRedraw();
  const [typed, setTyped] = useState<string | null>(null); // what is in the field while it has the focus
  const escaped = useRef(false);

  const commit = (text: string) => {
    const name = normalizeMapName(text);
    if (name !== state.mapName) {
      state.mapName = name;
      persistMapName();
      broadcastDocument();
    }
    renderPageTitle();
  };

  const shown = typed ?? state.mapName;
  return (
    <>
      {/* The input can't size itself to its text, so a hidden copy of the text sits in the same grid cell
          and gives the box its width. */}
      <span id="map-title-mirror" aria-hidden="true">
        {shown || PLACEHOLDER}
      </span>
      <input
        id="map-name"
        type="text"
        maxLength={60}
        placeholder={PLACEHOLDER}
        aria-label="Map name"
        title="Rename map"
        autoComplete="off"
        autoCapitalize="words"
        spellcheck={false}
        enterkeyhint="done"
        value={shown}
        onFocus={() => setTyped(state.mapName)}
        onInput={(e) => setTyped(e.currentTarget.value)}
        onBlur={() => {
          if (typed !== null && !escaped.current) commit(typed);
          escaped.current = false;
          setTyped(null); // shows the name as it was kept (trimmed, tidied)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur(); // which commits
          } else if (e.key === 'Escape') {
            escaped.current = true; // the old name stays; then leave
            e.currentTarget.blur();
          }
        }}
      />
      <svg class="map-title-edit" width="16" height="16" aria-hidden="true">
        <use href="/icons.svg#icon-edit" />
      </svg>
    </>
  );
}

state.mapName = loadPersistedMapName();
render(<MapName />, byId('map-title'));
renderPageTitle();
