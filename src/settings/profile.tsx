// ── Settings: the Profile panel ────────────────────────────────
// Your name in shared maps (collab/player.ts): type one and press Enter or click away to keep it, or
// shuffle for a suggestion from the fantasy lists. Escape or an unusable (empty) name puts the old one
// back. Chosen first in "Who's at the table?" (ui/name-dialog.ts), which asks only if there is no name.

import { useEffect, useRef, useState } from 'preact/hooks';
import { me, onNameChanged, setName } from '../collab/player';
import { randomPlayerName } from '../core/player-name';
import { flashSaved } from './saved';

export function ProfilePanel({ active }: { active: boolean }) {
  const [text, setText] = useState(me.name);
  const input = useRef<HTMLInputElement>(null);

  // A name kept from anywhere (here, or the "Who's at the table?" dialog) shows, and is said to be saved.
  useEffect(
    () =>
      onNameChanged(() => {
        setText(me.name);
        flashSaved();
      }),
    [],
  );

  return (
    <section
      id="settings-panel-profile"
      class="settings-panel"
      role="tabpanel"
      aria-labelledby="settings-tab-profile"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel is a tab stop, as in the WAI-ARIA tabs pattern
      tabIndex={0}
      hidden={!active}
    >
      <h3>Profile</h3>
      <p class="settings-note">
        Shown to others in shared maps, by your cursor and in the list of players. Saved in this browser.
        Nobody checks it, so it is only a label.
      </p>
      <div class="settings-field">
        <label for="profile-name">Your name</label>
        <div class="name-row">
          <input
            type="text"
            id="profile-name"
            maxLength={40}
            autoComplete="off"
            spellcheck={false}
            ref={input}
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setText(me.name);
            }}
            onBlur={() => setText(me.name)}
          />
          <button
            type="button"
            class="icon-btn"
            id="profile-shuffle"
            aria-label="Suggest another name"
            title="Suggest another name"
            onClick={() => {
              setName(randomPlayerName(me.name));
              input.current?.focus();
            }}
          >
            <svg width="18" height="18" aria-hidden="true">
              <use href="/icons.svg#icon-shuffle" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
