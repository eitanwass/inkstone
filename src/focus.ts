// ── Focus handling for modals ──────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab cycling inside container while it is open, so
// keyboard focus can't wander to the page behind a modal.
export function trapFocus(container: HTMLElement): void {
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// Puts focus back where it was before a modal opened, if that's still possible.
export function restoreFocus(previous: Element | null): void {
  if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
}
