// ── Shared app state ─────────────────────────────────────────
// A single mutable object rather than a store/class — every module imports
// this same reference and mutates its properties directly, then calls
// drawMain()/drawGrid() to re-render. No framework, no virtual DOM.

export const GRID = 40; // px per grid cell (logical)

export const state = {
  tool: 'select',
  strokeColor: '#e8dcc8',
  fillColor: '#463b29',
  strokeWidth: 4,
  fontSize: 14,
  // Viewport transform
  panX: 0,
  panY: 0,
  zoom: 1,
  // Interaction
  isPanning: false,
  panStart: null,
  altHeld: false,
  isDragging: false,
  dragStart: null,
  // Selection: array of indices into elements[]
  selected: [],
  hoveredToken: null, // index
  // Rubber-band select
  isBoxSelecting: false,
  selectBox: null,
  selectionBoxAdditive: false,
  // For in-progress draw
  preview: null,
  // Elements (shapes, tokens, labels)
  elements: [],
  // Moving the current selection
  elementDrag: null,
  // Resizing/rotating a single selected rect or wall via its handles
  handleDrag: null,
  // Erase drag
  isErasing: false,
  // Element under the eraser cursor, shown as a deletion preview
  eraseHover: null,
};
