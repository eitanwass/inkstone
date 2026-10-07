// ── The library ────────────────────────────────────────────────
// The open-book button under the logo opens a panel of things to start from: sample maps for now, and
// models and tokens that players share with each other later, which is why it already filters (by type,
// and by a search). The list is public/library/index.json, read the first time the panel opens and
// checked by parseLibrary; a map is fetched when its card is chosen and opened like a map file is
// (open-map.ts: one undo step, with an Undo toast).
//
// This is the first part of the app written with Preact (a pilot): the panel is a component, drawn into
// #library-root, and the button under the logo (static, in html/brand.html) is wired to it from here.

import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { byId } from '../core/dom';
import {
  filterLibrary,
  LIBRARY_KINDS,
  type LibraryItem,
  type LibraryKind,
  parseLibrary,
} from '../core/library';
import { parseMapFile } from '../core/map-file';
import { filterMaps, whenParked } from '../core/maps';
import { restoreFocus, trapFocus } from './focus';
import { deleteMap, hasParkedMaps, listMaps, type MyMap, newMap, openAsNewMap, openSavedMap } from './maps';
import { showConfirm } from './modal';
import { showToast } from './toast';

const INDEX_URL = '/library/index.json';

type Load = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; items: LibraryItem[] };

// The list, read once the panel has been opened (and again on "Try again").
function useLibraryItems(wanted: boolean): [Load, () => void] {
  const [load, setLoad] = useState<Load>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wanted || load.status === 'ready') return;
    let stale = false;
    setLoad({ status: 'loading' });
    fetch(INDEX_URL)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((json) => stale || setLoad({ status: 'ready', items: parseLibrary(json) }))
      .catch(() => stale || setLoad({ status: 'error' }));
    return () => {
      stale = true;
    };
  }, [wanted, attempt]);
  return [load, () => setAttempt((n) => n + 1)];
}

function Card({ item, disabled, onOpen }: { item: LibraryItem; disabled: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" class="library-card" disabled={disabled} onClick={onOpen}>
        <img src={item.thumbnail} alt="" width={400} height={260} loading="lazy" />
        <span class="library-card-body">
          <span class="library-card-title">{item.title}</span>
          {/* the card cuts a long description short, so the whole of it is the tooltip */}
          <span class="library-card-desc" title={item.description}>
            {item.description}
          </span>
          <span class="library-card-meta">
            by <strong>{item.author}</strong>
          </span>
        </span>
      </button>
    </li>
  );
}

// A map of the player's own: its card opens it, and a small button beside the card deletes it.
function MyMapCard({ map, onOpen, onDelete }: { map: MyMap; onOpen: () => void; onDelete: () => void }) {
  const title = map.name || 'Untitled map';
  return (
    <li class="library-card-wrap">
      <button type="button" class="library-card" onClick={onOpen}>
        {map.thumbnail ? (
          <img src={map.thumbnail} alt="" width={400} height={260} />
        ) : (
          <span class="library-card-blank" aria-hidden="true" />
        )}
        <span class="library-card-body">
          <span class="library-card-title">{title}</span>
          <span class="library-card-meta">
            {map.current ? 'On the board now' : `Kept ${whenParked(map.updated, Date.now())}`}
          </span>
        </span>
      </button>
      <button type="button" class="library-card-delete" aria-label={`Delete ${title}`} onClick={onDelete}>
        Delete
      </button>
    </li>
  );
}

function Library() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [section, setSection] = useState<'mine' | LibraryKind>('map');
  const [mine, setMine] = useState<MyMap[]>([]);
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState(false);
  const [load, retry] = useLibraryItems(everOpened);
  const opener = useRef<Element | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    restoreFocus(opener.current ?? byId('btn-library'));
  };

  // The book button under the logo opens it.
  useEffect(() => {
    const button = byId('btn-library');
    const show = () => {
      opener.current = document.activeElement;
      setMine(listMaps());
      setSection(hasParkedMaps() ? 'mine' : 'map'); // the player's own maps first, once there is more than one
      setOpen(true);
      setEverOpened(true);
    };
    button.addEventListener('click', show);
    return () => button.removeEventListener('click', show);
  }, []);
  useEffect(() => {
    byId('btn-library').setAttribute('aria-expanded', String(open));
  }, [open]);

  // While it is open: focus goes in and stays in, and Escape closes it.
  useEffect(() => {
    if (!open || !modal.current) return;
    modal.current.focus();
    trapFocus(modal.current); // the element is made anew each time it opens
    const onKey = (e: KeyboardEvent) => {
      // (not while the confirm dialog, opened from here, is the one being answered)
      if (e.key === 'Escape' && byId('modal-overlay').classList.contains('hidden')) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function openItem(item: LibraryItem): Promise<void> {
    if (opening || item.kind !== 'map') return;
    setOpening(true);
    try {
      const response = await fetch(item.file);
      if (!response.ok) throw new Error(String(response.status));
      const map = parseMapFile(await response.text());
      if (!map) throw new Error('not a map file');
      close();
      openAsNewMap(map, `Opened "${item.title}" as a new map`);
    } catch {
      showToast("Couldn't open that map. Check your connection and try again.");
    } finally {
      setOpening(false);
    }
  }

  if (!open) return null;

  const inMine = section === 'mine';
  const items = load.status === 'ready' ? load.items : [];
  const kind: LibraryKind = inMine ? 'map' : section;
  const shown = filterLibrary(items, { kind, query });
  const shownMine = filterMaps(mine, query);
  const total = inMine ? mine.length : items.filter((item) => item.kind === kind).length;
  const matches = inMine ? shownMine.length : shown.length;
  const label = inMine ? 'maps' : (LIBRARY_KINDS.find((k) => k.kind === kind)?.label.toLowerCase() ?? '');
  const noun = total === 1 ? label.replace(/s$/, '') : label; // "1 of 3 maps", "1 map"
  const count = matches === total ? `${total} ${noun}` : `${matches} of ${total} ${noun}`;

  let message: string | null = null;
  if (inMine) {
    if (total && !matches) message = 'Nothing matches those filters.';
  } else if (load.status === 'idle' || load.status === 'loading') message = 'Loading the library…';
  else if (load.status === 'error') message = "Couldn't load the library. Check your connection.";
  else if (!shown.length)
    message = total ? 'Nothing matches those filters.' : `There are no ${label} here yet.`;
  const showCount = inMine || load.status === 'ready';

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a click on the backdrop is a convenience; Escape and the Close button are the keyboard ways
    <div
      id="library-overlay"
      role="presentation"
      onClick={(e) => {
        // A click on the blurred page outside the modal closes it.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        id="library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        tabIndex={-1}
        ref={modal}
      >
        <div id="library-header">
          <h2 id="library-title">Library</h2>
          <button type="button" class="icon-btn" id="library-close" aria-label="Close" onClick={close}>
            <svg width="18" height="18" aria-hidden="true">
              <use href="/icons.svg#icon-close" />
            </svg>
          </button>
        </div>
        <div id="library-layout">
          <div id="library-filters">
            <div class="library-field">
              <label htmlFor="library-search">Search</label>
              <input
                type="search"
                id="library-search"
                placeholder="Name or author"
                autoComplete="off"
                spellcheck={false}
                value={query}
                ref={search}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
            </div>
            <fieldset class="library-field">
              <legend>Browse</legend>
              <div id="library-kinds">
                <button
                  type="button"
                  class="library-section"
                  id="library-mine"
                  aria-pressed={inMine}
                  onClick={() => setSection('mine')}
                >
                  My Maps
                </button>
                <hr class="library-separator" />
                {load.status === 'ready' &&
                  LIBRARY_KINDS.map(({ kind: k, label: text }) => {
                    const empty = !items.some((item) => item.kind === k);
                    return (
                      <button
                        type="button"
                        class="library-kind"
                        aria-pressed={!inMine && k === kind}
                        disabled={empty}
                        onClick={() => setSection(k)}
                      >
                        {text}
                        {empty && <span class="library-soon">Soon</span>}
                      </button>
                    );
                  })}
              </div>
            </fieldset>
            <button
              type="button"
              class="btn-secondary"
              id="library-clear"
              hidden={!query}
              onClick={() => {
                setQuery('');
                search.current?.focus();
              }}
            >
              Clear filters
            </button>
          </div>
          <section id="library-main" aria-labelledby="library-count" tabIndex={-1}>
            <p id="library-count" role="status">
              {showCount ? count : ''}
            </p>
            <p id="library-message" hidden={message === null}>
              {message}
              {load.status === 'error' && (
                <>
                  <br />
                  <button type="button" class="btn-secondary" onClick={retry}>
                    Try again
                  </button>
                </>
              )}
            </p>
            <ul id="library-grid" aria-busy={opening || undefined}>
              {inMine && (
                <li>
                  <button
                    type="button"
                    class="library-card library-card-new"
                    id="library-new-map"
                    onClick={() => {
                      close();
                      newMap();
                    }}
                  >
                    <span class="library-card-plus" aria-hidden="true">
                      +
                    </span>
                    New map
                  </button>
                </li>
              )}
              {inMine
                ? shownMine.map((map) => (
                    <MyMapCard
                      key={map.id}
                      map={map}
                      onOpen={() => {
                        close();
                        openSavedMap(map.id);
                      }}
                      onDelete={() =>
                        showConfirm(`Delete "${map.name || 'Untitled map'}"? This can't be undone.`, () => {
                          deleteMap(map.id);
                          setMine(listMaps());
                        })
                      }
                    />
                  ))
                : shown.map((item) => (
                    <Card key={item.id} item={item} disabled={opening} onOpen={() => void openItem(item)} />
                  ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

render(<Library />, byId('library-root'));
