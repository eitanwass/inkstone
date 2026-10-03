// ── "What's new" panel ─────────────────────────────────────────
// Lists the releases in CHANGELOG.md, newest first, in a popover under the
// changelog button. The button carries a dot until the user has opened the
// panel for the current version.

import changelogText from '../CHANGELOG.md?raw';
import { version } from '../package.json';
import { parseChangelog } from './changelog-parse';
import { byId } from './dom';
import { closePopover, positionPopover } from './popover';
import { storageGet, storageSet } from './storage';

const SEEN_KEY = 'inkstone-changelog-seen';

const button = byId('btn-changelog');
const popover = byId('changelog-popover');

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

function hidePopover(): void {
  closePopover(popover, button);
}

renderEntries();
if (lastSeenVersion() !== version) button.classList.add('has-update');

button.addEventListener('click', (e) => {
  e.stopPropagation();
  if (popover.classList.contains('hidden')) {
    positionPopover(popover, button);
    popover.focus();
    markSeen();
  } else {
    hidePopover();
  }
});

document.addEventListener('click', (e) => {
  if (!popover.contains(e.target as Node) && e.target !== button) hidePopover();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
    hidePopover();
    button.focus();
  }
});
