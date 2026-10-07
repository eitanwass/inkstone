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
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { byId } from '../core/dom';
import { restoreFocus, trapFocus } from '../ui/focus';
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('board');
  const [saved, setSaved] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const opener = useRef<Element | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (modal.current) trapFocus(modal.current);
    onSavedChange(setSaved);
    const show = () => {
      opener.current = document.activeElement;
      setOpen(true);
    };
    openButton.addEventListener('click', show);
    return () => openButton.removeEventListener('click', show);
  }, []);

  // Opening puts focus in the dialog; closing gives it back to what had it.
  useLayoutEffect(() => {
    if (open) modal.current?.focus();
    else if (wasOpen.current) restoreFocus(opener.current ?? openButton);
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    // A click on the blurred page outside the modal closes it.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (above); the click is only for the backdrop
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop, not a control
    <div
      id="settings-overlay"
      class={open ? undefined : 'hidden'}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
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
          <button
            type="button"
            class="icon-btn"
            id="settings-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
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
            {/* Quietly at the bottom: Inkstone is free, and this is the one place that says how to chip in.
                The same page as the home page's (index.html). */}
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
          <BoardPanel active={tab === 'board'} open={open} />
          <ConditionsPanel active={tab === 'conditions'} />
          <ProfilePanel active={tab === 'profile'} />
        </div>
      </div>
    </div>
  );
}

render(<Settings />, byId('settings-root'));
