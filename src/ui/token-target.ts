// ── Which token the card is for ───────────────────────────────
// Shared by the token card's parts (token-card.ts, token-card-color.ts, token-card-image.ts,
// token-card-conditions.ts) and the hover list (token-tip.ts).

import { state } from '../core/state';
import type { TokenElement } from '../core/types';

// The one selected token, while the select tool is in use.
export function cardToken(): TokenElement | null {
  if (state.tool !== 'select' || state.selected.length !== 1) return null;
  const el = state.elements[state.selected[0]];
  return el?.type === 'token' ? el : null;
}
