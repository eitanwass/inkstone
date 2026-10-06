// ── What every page of the site does ───────────────────────────
// The fonts, the scroll-reveal animation, the menu that folds on small screens and the mark on the
// page you are on. The pages read fine without any of it.

import '@fontsource-variable/inter';
import '@fontsource/eb-garamond/500.css';
import { byId } from './core/dom';

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

// The menu says which page this is.
for (const link of links.querySelectorAll<HTMLAnchorElement>('a:not(.nav-cta)')) {
  if (link.pathname === location.pathname && !link.hash) link.setAttribute('aria-current', 'page');
}
