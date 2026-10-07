// ── "What's new" modal ─────────────────────────────────────────
// Lists the releases in CHANGELOG.md, newest first, in a modal over a blurred
// page, opened from the changelog button. The button carries a dot until the
// player has opened the modal for the current version.
//
// It is a Preact component (see library.tsx), drawn into #changelog-root; what every modal does (open,
// focus, Escape, the backdrop) is use-modal.ts.

import { render } from 'preact';
import changelogText from '../../CHANGELOG.md?raw';
import { version } from '../../package.json';
import { byId } from '../core/dom';
import { storageGet, storageSet } from '../core/storage';
import { parseChangelog } from './changelog-parse';
import { useModal } from './use-modal';

const SEEN_KEY = 'inkstone-changelog-seen';

const button = byId('btn-changelog');
const entries = parseChangelog(changelogText);

function markSeen(): void {
  button.classList.remove('has-update');
  storageSet(SEEN_KEY, version); // if storage is unavailable, the dot just comes back next visit
}

if (storageGet(SEEN_KEY) !== version) button.classList.add('has-update');

function Changelog() {
  const { open, close, modal, onBackdropClick } = useModal(button, markSeen);

  return (
    // A click on the blurred page outside the modal closes it.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (use-modal.ts); the click is only for the backdrop
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop, not a control
    <div id="changelog-overlay" class={open ? undefined : 'hidden'} onClick={onBackdropClick}>
      <div
        id="changelog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        tabIndex={-1}
        ref={modal}
      >
        <div id="changelog-header">
          <h2 id="changelog-title">What's new</h2>
          <button type="button" class="icon-btn" id="changelog-close" aria-label="Close" onClick={close}>
            <svg width="18" height="18" aria-hidden="true">
              <use href="/icons.svg#icon-close" />
            </svg>
          </button>
        </div>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region has to be reachable by keyboard */}
        <div id="changelog-body" role="region" aria-label="Release notes" tabIndex={0}>
          <div id="changelog-list">
            {entries.map((entry) => (
              <section class="changelog-entry" key={entry.version}>
                <h3>
                  {`v${entry.version}`}
                  {entry.date && <time>{entry.date}</time>}
                </h3>
                <ul>
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

render(<Changelog />, byId('changelog-root'));
