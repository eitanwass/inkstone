// ── What a tool can do ────────────────────────────────────────
// pointer.ts handles the events every tool shares (panning, touch, zoom) and hands the rest to the
// active tool through these hooks, so it never has to ask which tool it is. Every hook is
// optional. The tool that took the press also gets that gesture's moves and its release, even if
// the active tool changes meanwhile.

import type { Point } from '../../core/types';

export interface Tool {
  /** The primary button went down. */
  press?(e: PointerEvent, world: Point): void;
  /** The pointer moved. Return true if a gesture of this tool took the move. */
  move?(e: PointerEvent, world: Point): boolean;
  /** The button came up. */
  release?(e: PointerEvent, world: Point): void;
  /** The gesture was abandoned (pointercancel, or another press). */
  cancel?(): void;
  /** The pointer moved with no gesture going: cursor and hover previews. */
  hover?(world: Point): void;
}
