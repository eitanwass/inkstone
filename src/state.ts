// ── Shared app state ─────────────────────────────────────────
// A single mutable object rather than a store/class — every module imports
// this same reference and mutates its properties directly, then calls
// drawMain()/drawGrid() to re-render. No framework, no virtual DOM.

import type { BoardElement, ElementDrag, EraseHover, HandleDrag, Point, SelectBox, Tool } from './types';

export const GRID = 40; // px per grid cell (logical)

// Tokens saved before variable sizing existed have no radius, so every reader
// falls back to DEFAULT_TOKEN_RADIUS.
export const DEFAULT_TOKEN_RADIUS = GRID * 0.42;
export const MAX_TOKEN_RADIUS = GRID * 2.5;
export const MIN_SHAPE_SIZE = GRID * 0.3; // smaller rect/wall drags are discarded as stray clicks
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 8;
export const DEFAULT_FONT_SIZE = 14;
export const FONT_FAMILY = "'Segoe UI', sans-serif";

interface AppState {
  tool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  // Viewport transform
  panX: number;
  panY: number;
  zoom: number;
  // Interaction
  isPanning: boolean;
  panStart: Point | null;
  altHeld: boolean;
  isDragging: boolean;
  dragStart: Point | null;
  // Selection: array of indices into elements[]
  selected: number[];
  hoveredToken: number | null; // index
  // Rubber-band select
  isBoxSelecting: boolean;
  selectBox: SelectBox | null;
  selectionBoxAdditive: boolean;
  // For in-progress draw
  preview: BoardElement | null;
  // Elements (shapes, tokens, labels)
  elements: BoardElement[];
  // Moving the current selection
  elementDrag: ElementDrag | null;
  // Resizing/rotating a single selected element via its handles
  handleDrag: HandleDrag | null;
  // Erase drag
  isErasing: boolean;
  // Element under the eraser cursor, shown as a deletion preview
  eraseHover: EraseHover | null;
}

export const state: AppState = {
  tool: 'select',
  strokeColor: '#e8dcc8',
  fillColor: '#463b29',
  strokeWidth: 4,
  fontSize: DEFAULT_FONT_SIZE,
  panX: 0,
  panY: 0,
  zoom: 1,
  isPanning: false,
  panStart: null,
  altHeld: false,
  isDragging: false,
  dragStart: null,
  selected: [],
  hoveredToken: null,
  isBoxSelecting: false,
  selectBox: null,
  selectionBoxAdditive: false,
  preview: null,
  elements: [],
  elementDrag: null,
  handleDrag: null,
  isErasing: false,
  eraseHover: null,
};

// Aborts whatever single-pointer tool action is mid-flight (a draw preview,
// a box-select, an element/handle drag, an erase stroke) without touching
// the current selection. Used when a 2nd finger turns a gesture into a
// pinch, on a touch long-press, and by Escape (which additionally clears the
// selection itself).
export function cancelInProgressDrag() {
  state.preview = null;
  state.isDragging = false;
  state.isBoxSelecting = false;
  state.selectBox = null;
  state.elementDrag = null;
  state.handleDrag = null;
  state.isErasing = false;
}
