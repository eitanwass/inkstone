import { byId } from '../core/dom';

// On a phone the action bar shows only undo, redo and this button; it drops down the rest.
const cluster = byId('action-cluster');
const more = byId('btn-more');

function setOpen(open: boolean) {
  cluster.classList.toggle('open', open);
  more.setAttribute('aria-expanded', String(open));
}

more.addEventListener('click', () => setOpen(!cluster.classList.contains('open')));

// A choice in the dropdown closes it, unless it opens a popover that is placed under its button
// (Share, Join), which has to stay on screen. Tapping elsewhere or Escape closes it too.
byId('action-more').addEventListener('click', (e) => {
  const button = (e.target as Element).closest('button');
  if (button && button.id !== 'btn-share' && button.id !== 'btn-join') setOpen(false);
});
document.addEventListener('pointerdown', (e) => {
  if (!cluster.contains(e.target as Node)) setOpen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cluster.classList.contains('open')) {
    setOpen(false);
    more.focus();
  }
});
