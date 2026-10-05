// ── Where a floating card goes ──────────────────────────────────
// The token card and the label card both float next to what is selected: above it, or below it if the
// top of the screen is in the way. Pure, so it is unit tested.

const GAP_PX = 14; // between the thing and the card
const KEEP_CLEAR_OF_TOP_PX = 96; // the map name and the action cluster
const MARGIN_PX = 8; // kept between the card and the edge of the screen

export interface CardSpot {
  centerX: number; // on screen: the middle of what the card is for
  top: number; // its top edge
  bottom: number; // its bottom edge, including anything written under it (a token's name)
  width: number; // the card's own size
  height: number;
  screenTop: number; // the top of the map on the screen
  viewportWidth: number;
  viewportHeight: number;
}

// The card's top left corner. Above the thing, or below it if the top of the screen is in the way. A
// tall card (a picker open) may fit on neither side, so it goes where there is more room, and is then
// kept on the screen even if that means covering part of the thing.
export function cardPosition(s: CardSpot): { left: number; top: number } {
  const above = s.top - GAP_PX - s.height;
  const below = s.bottom + GAP_PX;
  const roomAbove = s.top - GAP_PX - (s.screenTop + KEEP_CLEAR_OF_TOP_PX);
  const roomBelow = s.screenTop + s.viewportHeight - below - MARGIN_PX;
  let top = above >= s.screenTop + KEEP_CLEAR_OF_TOP_PX ? above : below;
  if (top === below && roomBelow < s.height && roomAbove > roomBelow) top = above;
  top = Math.max(MARGIN_PX, Math.min(top, s.viewportHeight - s.height - MARGIN_PX));
  const left = Math.max(MARGIN_PX, Math.min(s.centerX - s.width / 2, s.viewportWidth - s.width - MARGIN_PX));
  return { left, top };
}
