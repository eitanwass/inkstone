// ── The home page ──────────────────────────────────────────────
// Only the touches that need script: the entrance and scroll-reveal animations, the map that eases
// back as the page slides over it, the menu on small screens, and "Continue" for someone who already
// has a map. The page reads fine without any of it.

import '@fontsource-variable/inter';
import '@fontsource/eb-garamond/500.css';
import { byId } from './core/dom';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Things fade up as they scroll into view. The class is only added once, so they stay put after.
const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      reveal.unobserve(entry.target);
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
);
for (const el of document.querySelectorAll('[data-reveal]')) reveal.observe(el);

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

// The links fold into a menu on small screens.
const toggle = byId<HTMLButtonElement>('menu-toggle');
const links = byId('site-links');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  links.classList.toggle('open', open);
});
links.addEventListener('click', (e) => {
  if (!(e.target instanceof HTMLAnchorElement)) return;
  toggle.setAttribute('aria-expanded', 'false');
  links.classList.remove('open');
});
