// ── Shared types ──────────────────────────────────────────────
// Board elements are plain data (saved, cloned for undo, synced to peers), so
// they're modelled as a discriminated union on `type`. Their behavior lives in
// src/elements/ — see elements/index.ts.

import type { Condition } from './conditions';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Style fields any element may carry; only the ones a type uses are set.
interface ElementStyle {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

export interface RectElement extends ElementStyle {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface WallElement extends ElementStyle {
  type: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TokenElement extends ElementStyle {
  type: 'token';
  x: number;
  y: number;
  // Missing on boards saved before variable token sizes existed.
  radius?: number;
  name?: string;
  color?: string;
  // What it is under (Prone, Poisoned, a custom one...), whole objects rather than names: see
  // conditions/. None when there are none (the field is left off, not an empty list).
  conditions?: Condition[];
}

export interface LabelElement extends ElementStyle {
  type: 'label';
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}

export type BoardElement = RectElement | WallElement | TokenElement | LabelElement;
export type ElementType = BoardElement['type'];

// An element's own position, captured at drag start so deltas apply cleanly.
export interface WallCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export type Coords = Point | WallCoords;

// What a collaborator sends and receives: the whole board, plus the map's name.
// Older clients send just the elements, so the name is optional here.
export interface BoardSnapshot {
  elements: BoardElement[];
  name?: string;
}

export type Tool = 'select' | 'rect' | 'wall' | 'token' | 'text' | 'erase' | 'ruler';

// One measured stretch of a shape, e.g. a room's width: from `from` to `to` (world coordinates),
// its length as text, and which way to push the ruler line off the shape (a unit vector, so
// it sits beside the edge instead of on it).
export interface Dimension {
  from: Point;
  to: Point;
  text: string;
  offset: Point;
}

// The line the ruler tool has drawn, in world coordinates. Never saved or shared.
export interface Ruler {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export type HandleKind = 'resize' | 'rotate' | 'endpoint' | 'resize-radius';

export interface Handle extends Point {
  id: string;
  kind: HandleKind;
  // Rotate handles only: where the connector line to the element starts.
  from?: Point;
}

// What a click with the eraser would do to one element.
export interface EraseTarget {
  pieces: BoardElement[]; // elements left behind (none for a whole-element erase)
  highlight: SegmentHighlight | null; // the part being removed, if not the whole element
}

export interface SegmentHighlight {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth?: number;
}

export type EraseHover = ({ kind: 'segment' } & SegmentHighlight) | { kind: 'element'; idx: number };

// ── In-progress interactions (live on `state`) ──────────────────

interface HandleDragBase {
  idx: number; // index of the element being edited
  moved: boolean;
}

export type HandleDrag =
  | (HandleDragBase & {
      kind: 'rotate';
      center: Point;
      startAngle: number;
      startRotation: number;
      startCoords: Coords;
      displayDeg?: number; // shown in the readout while rotating
    })
  | (HandleDragBase & { kind: 'resize'; corner: Corner; rotation: number; anchorWorld: Point })
  | (HandleDragBase & { kind: 'endpoint'; which: string })
  | (HandleDragBase & { kind: 'resize-radius' });

export interface ElementDrag {
  moved: boolean;
  origin: Point;
  snapshot: { i: number; coords: Coords }[];
}

export interface SelectBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Element behavior ────────────────────────────────────────────
// What each element type provides. See elements/index.ts for how the methods
// are used and what the defaults are for the optional ones.
export interface ElementBehavior<T extends BoardElement, S extends Coords = Coords> {
  center?(el: T): Point;
  draw(ctx: CanvasRenderingContext2D, el: T, isSelected: boolean): void;
  bounds(el: T): Bounds;
  hit(el: T, wx: number, wy: number): boolean;
  dimensions?(el: T): Dimension[];
  occupiesCell?(el: T, cellX: number, cellY: number): boolean;
  erase?(el: T, cellX: number, cellY: number): EraseTarget | null;
  snapshot?(el: T): S;
  translate?(el: T, dx: number, dy: number, origin?: S): void;
  handles?(el: T, rotateOffset: number): Handle[];
  rotate?(el: T, rotation: number, delta: number, pivot: Point, startCoords: S): void;
}
