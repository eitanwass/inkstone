// ── Settings ───────────────────────────────────────────────────
// A modal over a blurred page, opened from the gear button. Its panels are tabs down the left: Board
// (board.tsx), Conditions (conditions.tsx) and Profile (profile.tsx). Settings are kept in this browser
// (they are about how you read the map, not part of it), apply as they are changed, and are not shared
// with a live session.
//
// It is a Preact component (see ui/library.tsx), drawn into #settings-root and always in the page, hidden
// until opened. To add a panel: a tab in TABS below and a `<section role="tabpanel">` component for it
// in this folder, shown while `tab` is its id.

import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { COMMUNITY_URL } from '../community';
import { byId } from '../core/dom';
import { useModal } from '../ui/use-modal';
import { BoardPanel } from './board';
import { ConditionsPanel } from './conditions';
import { ProfilePanel } from './profile';
import { onSavedChange } from './saved';

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'profile', label: 'Profile' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ARROW_STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
const openButton = byId('btn-settings');

function Settings() {
  const { open, close, modal, onBackdropClick } = useModal(openButton);
  const [tab, setTab] = useState<TabId>('board');
  const [saved, setSaved] = useState(false);
  const tabButtons = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  useEffect(() => onSavedChange(setSaved), []);

  return (
    // A click on the blurred page outside the modal closes it.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (above); the click is only for the backdrop
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop, not a control
    <div id="settings-overlay" class={open ? undefined : 'hidden'} onClick={onBackdropClick}>
      <div
        id="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        ref={modal}
      >
        <div id="settings-header">
          <h2 id="settings-title">Settings</h2>
          {/* Says a change was kept: shown for a moment after each one (see src/settings/saved.ts) */}
          <span id="settings-saved" role="status" class={saved ? 'shown' : undefined}>
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M2.5 7.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span id="settings-saved-text">{saved ? 'Saved' : ''}</span>
          </span>
          <button type="button" class="icon-btn" id="settings-close" aria-label="Close" onClick={close}>
            <svg width="18" height="18" aria-hidden="true">
              <use href="/icons.svg#icon-close" />
            </svg>
          </button>
        </div>
        <div id="settings-layout">
          <div id="settings-side">
            {/* Up and Down (or Left and Right) move between the tabs, as in any tab list. */}
            <div
              id="settings-tabs"
              role="tablist"
              aria-label="Settings sections"
              aria-orientation="vertical"
              onKeyDown={(e) => {
                const step = ARROW_STEP[e.key];
                const at = TABS.findIndex(({ id }) => tabButtons.current[id] === document.activeElement);
                if (!step || at < 0) return;
                e.preventDefault();
                const next = TABS[(at + step + TABS.length) % TABS.length].id;
                setTab(next);
                tabButtons.current[next]?.focus();
              }}
            >
              {TABS.map(({ id, label }) => (
                <button
                  type="button"
                  id={`settings-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`settings-panel-${id}`}
                  tabIndex={tab === id ? 0 : -1} // the list is one tab stop; the arrow keys move within it
                  ref={(el) => {
                    tabButtons.current[id] = el;
                  }}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Quietly at the bottom: where to find other players, and how to chip in (Inkstone is free). The
                coffee address is the home page's (index.html); the community's is src/community.ts. */}
            <div id="settings-links">
              <a id="settings-community" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
                Join the community
              </a>
              <a
                id="settings-support"
                href="https://www.buymeacoffee.com/eitanwass"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" />
                  <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
                  <path d="M8 2.5c-.8 1 .8 1.6 0 2.8M12 2.5c-.8 1 .8 1.6 0 2.8" />
                </svg>
                Buy me a coffee
              </a>
            </div>
          </div>
          <BoardPanel active={tab === 'board'} open={open} />
          <ConditionsPanel active={tab === 'conditions'} />
          <ProfilePanel active={tab === 'profile'} />
        </div>
      </div>
    </div>
  );
}

render(<Settings />, byId('settings-root'));
