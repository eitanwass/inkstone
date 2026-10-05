// ── Map files ──────────────────────────────────────────────────
// A map saved to a .inkstone.json file: its name, its elements and the pictures its tokens use
// (the elements only carry picture ids, see elements/token-image.ts). Pure, so it is unit tested.

import type { BoardElement } from './types';
import { parseElements } from './validate';

const FORMAT = 'inkstone-map';
const VERSION = 1;
const MAX_FILE_CHARS = 20_000_000; // a map is kilobytes; this only stops a wrong file being read whole

export type MapFile = { name: string; elements: BoardElement[]; images: Record<string, string> };

export function serializeMap(map: MapFile): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, ...map }, null, 2);
}

// Returns null for anything that isn't a map file. Elements are checked like any other board data
// (bad ones dropped); the images are returned as found, and the caller's image store checks them.
export function parseMapFile(text: string): MapFile | null {
  if (text.length > MAX_FILE_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.format !== FORMAT || typeof r.version !== 'number' || r.version > VERSION) return null;
  const elements = parseElements(r.elements);
  if (!elements) return null;
  const images =
    typeof r.images === 'object' && r.images !== null ? (r.images as Record<string, string>) : {};
  return { name: typeof r.name === 'string' ? r.name : '', elements, images };
}
