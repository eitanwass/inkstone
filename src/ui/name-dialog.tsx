// ── "Who's at the table?" ──────────────────────────────────────
// Asked once, when someone first joins or shares a map and has no name yet: a suggested fantasy name in a
// field, a shuffle button beside it for another, and one way forward. There is no skip and Escape does
// nothing, because the suggestion is already a good name and a map should never hold anyone's name as
// blank. Someone who already has a name is never asked (it is kept in this browser, see collab/player.ts)
// and can change it in Settings, under Profile.
//
// It is a Preact component (see library.tsx), drawn into #name-root.

import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { hasName, setName } from '../collab/player';
import { byId } from '../core/dom';
import { randomPlayerName } from '../core/player-name';
import { restoreFocus, trapFocus } from './focus';

// Opens the dialog, to run `then` once a name is chosen. Set by the component below as it is drawn.
let ask: (then: () => void) => void = () => {};

// Runs `then` once there is a name: at once if there is one, else after the player has chosen one.
export function ensureName(then: () => void): void {
  if (hasName()) then();
  else ask(then);
}

function NameDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const onDone = useRef<(() => void) | null>(null);
  const wasOpen = useRef(false);

  ask = (then) => {
    opener.current = document.activeElement;
    onDone.current = then;
    setText(randomPlayerName(text));
    setOpen(true);
  };

  useEffect(() => {
    if (dialog.current) trapFocus(dialog.current);
  }, []);

  // Opened: the suggestion is in the field, selected, ready to be typed over.
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      field.current?.focus();
      field.current?.select();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div id="name-overlay" class={open ? undefined : 'hidden'}>
      <div
        id="name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-title"
        aria-describedby="name-note"
        ref={dialog}
      >
        <h2 id="name-title">Who's at the table?</h2>
        <p id="name-note">
          Others in the map see this name by your cursor. You can change it later in Settings.
        </p>
        <form
          id="name-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!setName(text)) return;
            setOpen(false);
            restoreFocus(opener.current);
            const next = onDone.current;
            onDone.current = null;
            next?.();
          }}
        >
          <div class="name-row">
            <input
              type="text"
              id="name-input"
              maxLength={40}
              aria-label="Your name"
              autoComplete="off"
              spellcheck={false}
              ref={field}
              value={text}
              onInput={(e) => setText(e.currentTarget.value)}
            />
            <button
              type="button"
              class="icon-btn"
              id="name-shuffle"
              aria-label="Suggest another name"
              title="Suggest another name"
              onClick={() => {
                setText(randomPlayerName(text));
                field.current?.focus();
              }}
            >
              <svg width="18" height="18" aria-hidden="true">
                <use href="/icons.svg#icon-shuffle" />
              </svg>
            </button>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn-primary" id="name-join" disabled={text.trim() === ''}>
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

render(<NameDialog />, byId('name-root'));
