// ── The "Saved" mark in Settings ───────────────────────────────
// Every setting is kept as soon as it is changed, so each panel says so here: a check and "Saved" at the
// top of the modal for a couple of seconds. The text is only present while it shows, so a screen reader
// announces it (it is a status region) each time.

import { byId } from '../core/dom';

const mark = byId('settings-saved');
const text = byId('settings-saved-text');
const SHOWN_MS = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;

export function flashSaved(): void {
  text.textContent = 'Saved';
  mark.classList.add('shown');
  clearTimeout(timer);
  timer = setTimeout(() => {
    mark.classList.remove('shown');
    text.textContent = '';
  }, SHOWN_MS);
}
