// ── My Maps: the list of maps kept in this browser ─────────────────
// The map on the board is the *working copy*: it is saved on every change under `inkstone-board` and
// `inkstone-map-name`, as it always was. The other maps are *parked*, each as its own key
// (`inkstone-map:<id>`, its elements) listed in an index (`inkstone-maps`: which id the working copy
// is, and the name, time and small picture of each parked map). Switching parks the working copy and
// takes another's place. Pure, so it is unit tested: anything read from storage goes through `parseIndex`.

import { normalizeMapName } from '../ui/map-name-text';
import type { BoardElement } from './types';

export const INDEX_KEY = 'inkstone-maps';
export const slotKey = (id: string): string => `inkstone-map:${id}`;

export const MAX_MAPS = 50;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const THUMBNAIL_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const MAX_THUMBNAIL = 80_000; // characters

export interface MapEntry {
  id: string;
  name: string; // '' is "Untitled map"
  updated: number; // milliseconds since 1970: when it was parked
  thumbnail?: string; // a small jpeg data URL
}

export interface MapIndex {
  current: string; // the id the working copy belongs to
  maps: MapEntry[]; // the parked ones
}

export const newMapId = (): string => `m-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;

// A map with nothing on it and no name is not worth keeping when it is left.
export const isBlankMap = (name: string, elements: readonly BoardElement[]): boolean =>
  !name.trim() && elements.length === 0;

function parseEntry(raw: unknown): MapEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return null;
  const updated = typeof r.updated === 'number' && Number.isFinite(r.updated) ? r.updated : 0;
  const entry: MapEntry = { id: r.id, name: normalizeMapName(r.name), updated };
  if (
    typeof r.thumbnail === 'string' &&
    r.thumbnail.length <= MAX_THUMBNAIL &&
    THUMBNAIL_RE.test(r.thumbnail)
  ) {
    entry.thumbnail = r.thumbnail;
  }
  return entry;
}

// The index as stored, the bad entries dropped; null if it isn't one. The working copy's id is never
// also a parked one.
export function parseIndex(raw: unknown): MapIndex | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { current, maps } = raw as { current?: unknown; maps?: unknown };
  if (typeof current !== 'string' || !ID_RE.test(current) || !Array.isArray(maps)) return null;
  const seen = new Set<string>([current]);
  const parked: MapEntry[] = [];
  for (const item of maps.slice(0, MAX_MAPS)) {
    const entry = parseEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    parked.push(entry);
  }
  return { current, maps: parked };
}

// The parked maps, most recently parked first.
export const byRecent = (maps: readonly MapEntry[]): MapEntry[] =>
  [...maps].sort((a, b) => b.updated - a.updated);

// How long ago a map was put away, in words ("just now", "3 hours ago", "yesterday"); a date once it is old.
export function whenParked(updated: number, now: number): string {
  const minutes = Math.floor((now - updated) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `on ${new Date(updated).toISOString().slice(0, 10)}`;
}

// The maps whose name has every word of `query` in it.
export function filterMaps<T extends { name: string }>(maps: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return maps.filter((m) => words.every((w) => (m.name || 'Untitled map').toLowerCase().includes(w)));
}

// `entry` added, or put in the place of the one with its id.
export function withEntry(index: MapIndex, entry: MapEntry): MapIndex {
  const maps = index.maps.some((m) => m.id === entry.id)
    ? index.maps.map((m) => (m.id === entry.id ? entry : m))
    : [...index.maps, entry];
  return { ...index, maps };
}

export const withoutEntry = (index: MapIndex, id: string): MapIndex => ({
  ...index,
  maps: index.maps.filter((m) => m.id !== id),
});
