// ── A condition's badge in the page ────────────────────────────
// The same round badge the canvas draws on a token (badges.ts), as an <svg> for the card, the menus
// and Settings. Built from DOM nodes, not an HTML string: a condition's name and color are text a
// player (or someone in their session) typed, so nothing of it is ever parsed as markup.

import { type Condition, ICONS } from './index';

const SVG = 'http://www.w3.org/2000/svg';

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const made = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  return made;
}

// The badge for `condition`, `size` pixels across. Decorative: whatever shows it also shows the name.
export function conditionBadge(condition: Condition, size: number): SVGSVGElement {
  const badge = node('svg', {
    class: 'condition-badge',
    width: String(size),
    height: String(size),
    viewBox: '-10 -10 20 20',
    'aria-hidden': 'true',
  });
  badge.append(node('circle', { r: '9', fill: condition.color, stroke: '#1e1b17', 'stroke-width': '1.6' }));

  const glyph = node('svg', {
    x: '-5.85',
    y: '-5.85',
    width: '11.7',
    height: '11.7',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#fff',
    'stroke-width': '2.4',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  const spec = ICONS[condition.icon];
  const path = node('path', { d: spec.d });
  if (spec.dash) path.setAttribute('stroke-dasharray', spec.dash.join(' '));
  glyph.append(path);
  badge.append(glyph);
  return badge;
}

// An icon on its own, for choosing one (no badge colour behind it): `color` is the line.
export function iconGlyph(icon: string, size: number): SVGSVGElement {
  const glyph = node('svg', {
    class: 'icon-glyph',
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  const spec = ICONS[icon];
  const path = node('path', { d: spec.d });
  if (spec.dash) path.setAttribute('stroke-dasharray', spec.dash.join(' '));
  glyph.append(path);
  return glyph;
}
