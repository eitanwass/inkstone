// ── Safe localStorage ──────────────────────────────────────────
// localStorage can throw (blocked by the browser, private mode, quota full),
// and anything in it can be stale or hand-edited. These wrappers never throw,
// so callers handle "couldn't read/write" as a normal outcome.

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Whether the write succeeded.
export function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

// A JSON list of strings, or [] if the key is missing, unparseable, or not
// a list of strings.
export function storageGetStrings(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(storageGet(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
