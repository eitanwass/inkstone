// ── Map names: the text rules ─────────────────────────────────
// Pure functions (no DOM), shared by the editor, the saved/received data
// checks, and the PNG export's file name.

export const MAP_NAME_MAX = 60;

// What a map's name is allowed to be: control characters (Unicode category Cc) become spaces, runs of
// whitespace collapse to one space, the ends are trimmed, and it is cut at
// MAP_NAME_MAX characters. Anything that isn't text is no name at all (""),
// which the app shows as "Untitled map".
export function normalizeMapName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAP_NAME_MAX)
    .trimEnd();
}

const FALLBACK_FILE_NAME = 'inkstone-map';

// A file-name-safe form of a map's name: lowercase, letters and numbers in any
// script kept, everything else collapsed to single dashes.
export function mapFileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return slug || FALLBACK_FILE_NAME;
}
