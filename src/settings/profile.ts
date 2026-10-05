// ── Settings: the Profile panel ────────────────────────────────
// Your name in shared maps (collab/player.ts): type one and press Enter or click away to keep it, or
// shuffle for a suggestion from the fantasy lists. Escape or an unusable (empty) name puts the old one
// back. Chosen first in "Who's at the table?" (ui/name-dialog.ts), which asks only if there is no name.

import { me, onNameChanged, setName } from '../collab/player';
import { byId } from '../core/dom';
import { randomPlayerName } from '../core/player-name';
import { flashSaved } from './saved';

const input = byId<HTMLInputElement>('profile-name');

const show = (): void => {
  input.value = me.name;
};
show();
onNameChanged(() => {
  show();
  flashSaved();
});

input.addEventListener('change', () => {
  setName(input.value);
  show();
});
input.addEventListener('blur', show);

byId('profile-shuffle').addEventListener('click', () => {
  setName(randomPlayerName(me.name));
  input.focus();
});
