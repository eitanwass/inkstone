// ── The home page ──────────────────────────────────────────────
// What only this page needs script for: the map that eases back as the page slides over it, and the light
// that follows the pointer over a feature card. (The rest is in site.ts.) The page reads fine without it.

import './site';
import { byId } from './core/dom';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The map is held still while the page slides over it, and eases back (smaller, dimmer) as it goes.
const hero = byId('hero-map');
let frame = 0;
function updateHero(): void {
  frame = 0;
  const progress = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
  hero.style.setProperty('--p', progress.toFixed(3));
}
if (!reduceMotion) {
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(updateHero);
    },
    { passive: true },
  );
  updateHero();
}

// A soft light follows the pointer across a feature card.
for (const card of document.querySelectorAll<HTMLElement>('.feature')) {
  card.addEventListener('pointermove', (e) => {
    const box = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - box.left}px`);
    card.style.setProperty('--my', `${e.clientY - box.top}px`);
  });
}
