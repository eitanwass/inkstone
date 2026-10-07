// ── What every modal opened from a button does ─────────────────
// Opens when its button is clicked, moves the focus into the dialog, keeps Tab inside it (focus.ts), closes
// on Escape or a click on the blurred page behind it (not one inside), and gives the focus back to what had
// it. The component draws the overlay (class `hidden` while closed), puts `modal` on the dialog and
// `onBackdropClick` on the overlay. Used by the Settings and What's new modals.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { restoreFocus, trapFocus } from './focus';

export function useModal(trigger: HTMLElement, onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (modal.current) trapFocus(modal.current);
    const show = () => {
      opener.current = document.activeElement;
      setOpen(true);
      onOpen?.();
    };
    trigger.addEventListener('click', show);
    return () => trigger.removeEventListener('click', show);
  }, [trigger, onOpen]);

  // Opening puts focus in the dialog; closing gives it back to what had it.
  useLayoutEffect(() => {
    if (open) modal.current?.focus();
    else if (wasOpen.current) restoreFocus(opener.current ?? trigger);
    wasOpen.current = open;
  }, [open, trigger]);

  // (a layout effect, so Escape works from the moment the dialog is there, not after the next paint)
  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const onBackdropClick = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (e.target === e.currentTarget) setOpen(false);
  };
  return { open, close, modal, onBackdropClick };
}
