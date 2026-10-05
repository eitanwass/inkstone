// ── "What's new" modal ─────────────────────────────────────────
// Lists the releases in CHANGELOG.md, newest first, in a modal over a blurred
// page, opened from the changelog button. The button carries a dot until the
// user has opened the modal for the current version.

import changelogText from '../../CHANGELOG.md?raw';
import { version } from '../../package.json';
import { byId } from '../core/dom';
import { storageGet, storageSet } from '../core/storage';
import { parseChangelog } from './changelog-parse';
import { restoreFocus, trapFocus } from './focus';

const SEEN_KEY = 'inkstone-changelog-seen';

const button = byId('btn-changelog');
const overlay = byId('changelog-overlay');
const modal = byId('changelog-modal');

function renderEntries(): void {
  const list = byId('changelog-list');
  for (const entry of parseChangelog(changelogText)) {
    const section = document.createElement('section');
    section.className = 'changelog-entry';

    const heading = document.createElement('h3');
    heading.append(`v${entry.version}`);
    if (entry.date) {
      const time = document.createElement('time');
      time.textContent = entry.date;
      heading.append(time);
    }

    const items = document.createElement('ul');
    for (const change of entry.changes) {
      const item = document.createElement('li');
      item.textContent = change;
      items.append(item);
    }

    section.append(heading, items);
    list.append(section);
  }
}

function lastSeenVersion(): string | null {
  return storageGet(SEEN_KEY);
}

function markSeen(): void {
  button.classList.remove('has-update');
  storageSet(SEEN_KEY, version); // if storage is unavailable, the dot just comes back next visit
}

let opener: Element | null = null;

function openModal(): void {
  opener = document.activeElement;
  overlay.classList.remove('hidden');
  modal.focus();
  markSeen();
}

function closeModal(): void {
  overlay.classList.add('hidden');
  restoreFocus(opener ?? button);
}

renderEntries();
if (lastSeenVersion() !== version) button.classList.add('has-update');
trapFocus(modal);

button.addEventListener('click', openModal);
byId('changelog-close').addEventListener('click', closeModal);

// A click on the blurred page outside the modal closes it.
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
});
