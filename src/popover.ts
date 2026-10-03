// ── Popover placement ──────────────────────────────────────────

// Shows popover just below anchorBtn, right-aligned to it and kept on screen.
export function positionPopover(popover: HTMLElement, anchorBtn: HTMLElement): void {
  popover.classList.remove('hidden');
  anchorBtn.setAttribute('aria-expanded', 'true');
  const r = anchorBtn.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const left = Math.max(8, Math.min(r.right - pw, window.innerWidth - pw - 8));
  popover.style.left = `${left}px`;
  popover.style.top = `${r.bottom + 8}px`;
}

// Hides popover and tells assistive tech its button is no longer expanded.
export function closePopover(popover: HTMLElement, anchorBtn: HTMLElement): void {
  popover.classList.add('hidden');
  anchorBtn.setAttribute('aria-expanded', 'false');
}
