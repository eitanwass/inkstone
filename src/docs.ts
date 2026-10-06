// ── The docs page ──────────────────────────────────────────────
// Marks the section being read in the list on the side. (The rest is in site.ts.)

import './site';
import { byId } from './core/dom';

const links = [...byId('toc').querySelectorAll<HTMLAnchorElement>('a')];
const sections = links.map((link) => document.getElementById(link.hash.slice(1))).filter((el) => el !== null);

function mark(id: string): void {
  for (const link of links) {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

// The section is "current" while it crosses the band a little below the top of the screen.
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) if (entry.isIntersecting) mark(entry.target.id);
  },
  { rootMargin: '-96px 0px -65% 0px' },
);
for (const section of sections) spy.observe(section);
