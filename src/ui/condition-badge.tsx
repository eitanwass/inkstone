// ── A condition's badge or icon, in a component ────────────────
// Both are built from DOM nodes (never an HTML string: names and colors are text players typed), so they
// are put in place by hand. The wrapper takes no room of its own.

import type { Condition } from '../conditions';
import { conditionBadge, iconGlyph } from '../conditions/icon';

export function Badge({ condition, size }: { condition: Condition; size: number }) {
  return (
    <span
      style={{ display: 'contents' }}
      ref={(el) => el?.replaceChildren(conditionBadge(condition, size))}
    />
  );
}

export function Glyph({ icon, size }: { icon: string; size: number }) {
  return <span style={{ display: 'contents' }} ref={(el) => el?.replaceChildren(iconGlyph(icon, size))} />;
}
