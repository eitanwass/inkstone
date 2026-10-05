// ── DOM lookup ────────────────────────────────────────────────

// querySelector counterpart of byId: throws if nothing in root matches.
export function qs<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

// getElementById that throws when the element is missing, so callers get a
// typed element instead of a nullable one. The ids all come from index.html and html/,
// so a miss is a programming error worth failing loudly on.
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
