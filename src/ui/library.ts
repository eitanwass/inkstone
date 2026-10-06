// ── The library ────────────────────────────────────────────────
// The open-book button under the logo opens a panel of things to start from: sample maps for now, and
// models and tokens that players share with each other later, which is why it already filters (by type,
// and by a search). The list is public/library/index.json, read the first time the panel opens and
// checked by parseLibrary; a map is fetched when its card is chosen and opened like a map file is
// (open-map.ts: one undo step, with an Undo toast).

import { byId } from '../core/dom';
import {
  filterLibrary,
  LIBRARY_KINDS,
  type LibraryFilter,
  type LibraryItem,
  type LibraryKind,
  parseLibrary,
} from '../core/library';
import { parseMapFile } from '../core/map-file';
import { restoreFocus, trapFocus } from './focus';
import { openMap } from './open-map';
import { showToast } from './toast';

const INDEX_URL = '/library/index.json';

const button = byId<HTMLButtonElement>('btn-library');
const overlay = byId('library-overlay');
const modal = byId('library-modal');
const search = byId<HTMLInputElement>('library-search');
const kindsBox = byId('library-kinds');
const clearButton = byId<HTMLButtonElement>('library-clear');
const count = byId('library-count');
const message = byId('library-message');
const grid = byId('library-grid');

let items: LibraryItem[] | null = null; // null until the list has been read
let loading = false;
const filter: LibraryFilter = { kind: 'map', query: '' };

// ── Reading the list ───────────────────────────────────────────
async function loadItems(): Promise<void> {
  if (items || loading) return;
  loading = true;
  showMessage('Loading the library…');
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) throw new Error(String(response.status));
    items = parseLibrary(await response.json());
  } catch {
    loading = false;
    showMessage("Couldn't load the library. Check your connection.", () => void loadItems());
    return;
  }
  loading = false;
  render();
}

// A line in place of the cards, with an optional button to try again.
function showMessage(text: string, retry?: () => void): void {
  grid.replaceChildren();
  count.textContent = '';
  message.hidden = false;
  message.replaceChildren(text);
  if (retry) {
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn-secondary';
    again.textContent = 'Try again';
    again.addEventListener('click', retry);
    message.append(document.createElement('br'), again);
  }
}

// ── Drawing the panel ──────────────────────────────────────────
const hasKind = (kind: LibraryKind): boolean => !!items?.some((item) => item.kind === kind);

function renderKinds(): void {
  kindsBox.replaceChildren(
    ...LIBRARY_KINDS.map(({ kind, label }) => {
      const kindButton = document.createElement('button');
      kindButton.type = 'button';
      kindButton.className = 'library-kind';
      kindButton.setAttribute('aria-pressed', String(kind === filter.kind));
      kindButton.append(label);
      if (!hasKind(kind)) {
        kindButton.disabled = true;
        const soon = document.createElement('span');
        soon.className = 'library-soon';
        soon.textContent = 'Soon';
        kindButton.append(soon);
      }
      kindButton.addEventListener('click', () => {
        filter.kind = kind;
        render();
      });
      return kindButton;
    }),
  );
}

function renderGrid(): void {
  if (!items) return;
  const shown = filterLibrary(items, filter);
  const total = items.filter((item) => item.kind === filter.kind).length;
  const label = LIBRARY_KINDS.find((k) => k.kind === filter.kind)?.label.toLowerCase() ?? '';
  const noun = total === 1 ? label.replace(/s$/, '') : label; // "1 of 3 maps", "1 map"
  count.textContent = shown.length === total ? `${total} ${noun}` : `${shown.length} of ${total} ${noun}`;
  clearButton.hidden = !filter.query;

  message.hidden = shown.length > 0;
  if (!shown.length) {
    message.textContent = total ? 'Nothing matches those filters.' : `There are no ${label} here yet.`;
  }
  grid.replaceChildren(...shown.map(card));
}

function card(item: LibraryItem): HTMLLIElement {
  const li = document.createElement('li');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'library-card';

  const picture = document.createElement('img');
  picture.src = item.thumbnail;
  picture.alt = '';
  picture.width = 400;
  picture.height = 260;
  picture.loading = 'lazy';

  const body = document.createElement('span');
  body.className = 'library-card-body';
  const title = document.createElement('span');
  title.className = 'library-card-title';
  title.textContent = item.title;
  const description = document.createElement('span');
  description.className = 'library-card-desc';
  description.textContent = item.description;
  description.title = item.description; // the card cuts it short, so the whole of it is here
  const author = document.createElement('strong');
  author.textContent = item.author;
  const meta = document.createElement('span');
  meta.className = 'library-card-meta';
  meta.append('by ', author);
  body.append(title, description, meta);

  open.append(picture, body);
  open.addEventListener('click', () => void openItem(item));
  li.append(open);
  return li;
}

function render(): void {
  renderKinds();
  renderGrid();
}

// ── Opening a map ──────────────────────────────────────────────
let opening = false;

async function openItem(item: LibraryItem): Promise<void> {
  if (opening || item.kind !== 'map') return;
  opening = true;
  grid.setAttribute('aria-busy', 'true');
  for (const card of grid.querySelectorAll<HTMLButtonElement>('.library-card')) card.disabled = true;
  try {
    const response = await fetch(item.file);
    if (!response.ok) throw new Error(String(response.status));
    const map = parseMapFile(await response.text());
    if (!map) throw new Error('not a map file');
    closeLibrary();
    openMap(map, `Opened "${item.title}"`);
  } catch {
    showToast("Couldn't open that map. Check your connection and try again.");
    for (const card of grid.querySelectorAll<HTMLButtonElement>('.library-card')) card.disabled = false;
  } finally {
    opening = false;
    grid.removeAttribute('aria-busy');
  }
}

// ── The panel itself ───────────────────────────────────────────
let opener: Element | null = null;

function openLibrary(): void {
  opener = document.activeElement;
  overlay.classList.remove('hidden');
  button.setAttribute('aria-expanded', 'true');
  modal.focus();
  if (items) render();
  else void loadItems();
}

function closeLibrary(): void {
  overlay.classList.add('hidden');
  button.setAttribute('aria-expanded', 'false');
  restoreFocus(opener ?? button);
}

search.addEventListener('input', () => {
  filter.query = search.value;
  renderGrid();
});

clearButton.addEventListener('click', () => {
  filter.query = '';
  search.value = '';
  renderGrid();
  search.focus();
});

trapFocus(modal);
button.addEventListener('click', openLibrary);
byId('library-close').addEventListener('click', closeLibrary);

// A click on the blurred page outside the modal closes it.
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeLibrary();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeLibrary();
});
