// ── "Who's at the table?" ──────────────────────────────────────
// Asked once, when someone first joins or shares a map and has no name yet: a suggested fantasy name in a
// field, a shuffle button beside it for another, and one way forward. There is no skip and Escape does
// nothing, because the suggestion is already a good name and a map should never hold anyone's name as
// blank. Someone who already has a name is never asked (it is kept in this browser, see collab/player.ts)
// and can change it in Settings, under Profile.

import { hasName, setName } from '../collab/player';
import { byId } from '../core/dom';
import { randomPlayerName } from '../core/player-name';
import { restoreFocus, trapFocus } from './focus';

const overlay = byId('name-overlay');
const dialog = byId('name-dialog');
const form = byId<HTMLFormElement>('name-form');
const input = byId<HTMLInputElement>('name-input');
const join = byId<HTMLButtonElement>('name-join');

let opener: Element | null = null;
let onDone: (() => void) | null = null;

function suggest(): void {
  input.value = randomPlayerName(input.value);
  join.disabled = false;
}

// Runs `then` once there is a name: at once if there is one, else after the player has chosen one.
export function ensureName(then: () => void): void {
  if (hasName()) {
    then();
    return;
  }
  opener = document.activeElement;
  onDone = then;
  suggest();
  overlay.classList.remove('hidden');
  input.focus();
  input.select();
}

trapFocus(dialog);
byId('name-shuffle').addEventListener('click', () => {
  suggest();
  input.focus();
});
input.addEventListener('input', () => {
  join.disabled = input.value.trim() === '';
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!setName(input.value)) return;
  overlay.classList.add('hidden');
  restoreFocus(opener);
  const next = onDone;
  onDone = null;
  next?.();
});
