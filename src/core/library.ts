// ── The library: what can be browsed and opened ────────────────
// The list the library panel shows (public/library/index.json): sample maps for now, and meant to hold
// models and tokens that players share with each other later. Every item says what it is (`kind`),
// what it is called, who made it, and where its file and thumbnail are. Pure, so it is unit
// tested: a list read from the network goes through `parseLibrary`, which drops anything malformed.

export type LibraryKind = 'map' | 'model' | 'token';

// What the panel offers, in order. A kind with nothing in it yet is shown as "Soon".
export const LIBRARY_KINDS: readonly { kind: LibraryKind; label: string }[] = [
  { kind: 'map', label: 'Maps' },
  { kind: 'model', label: 'Models' },
  { kind: 'token', label: 'Tokens' },
];

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  description: string;
  file: string; // an address on this site, under /library/
  thumbnail: string; // the same
  author: string;
}

export interface LibraryFilter {
  kind: LibraryKind;
  query: string; // every word of it must appear in the title, description or author
}

const MAX_ITEMS = 500;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Only addresses on this site, inside /library/: nothing in the list can send the page somewhere else.
const PATH_RE = /^\/library\/[a-z0-9][a-z0-9/_.-]{0,120}$/;

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.length <= max ? v.trim() : null;

const isKind = (v: unknown): v is LibraryKind => LIBRARY_KINDS.some((k) => k.kind === v);

function parseItem(raw: unknown): LibraryItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title, 80);
  const description = typeof r.description === 'string' ? r.description.slice(0, 300) : '';
  const author = text(r.author, 60) ?? 'Inkstone';
  const safePath = (v: unknown): v is string => typeof v === 'string' && PATH_RE.test(v) && !v.includes('..');
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || !isKind(r.kind) || !title) return null;
  if (!safePath(r.file) || !safePath(r.thumbnail)) return null;
  return { id: r.id, kind: r.kind, title, description, file: r.file, thumbnail: r.thumbnail, author };
}

// The items of a library list ({ version, items }), the bad ones dropped. Empty if it isn't one.
export function parseLibrary(raw: unknown): LibraryItem[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: LibraryItem[] = [];
  for (const entry of items.slice(0, MAX_ITEMS)) {
    const item = parseItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

// The items that match, in their own order.
export function filterLibrary(items: readonly LibraryItem[], filter: LibraryFilter): LibraryItem[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (item.kind !== filter.kind) return false;
    const haystack = `${item.title} ${item.description} ${item.author}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
