// ── The "Saved" mark in Settings ───────────────────────────────
// Every setting is kept as soon as it is changed, so each panel says so here: a check and "Saved" at the
// top of the modal for a couple of seconds (drawn by the Settings component, settings/index.tsx, which
// listens through `onSavedChange`). The text is only present while it shows, so a screen reader
// announces it (it is a status region) each time.

const SHOWN_MS = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;
let listener: (shown: boolean) => void = () => {};

export function onSavedChange(fn: (shown: boolean) => void): void {
  listener = fn;
}

export function flashSaved(): void {
  listener(true);
  clearTimeout(timer);
  timer = setTimeout(() => listener(false), SHOWN_MS);
}
