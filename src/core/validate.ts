// ── Board data validation ─────────────────────────────────────
// Board data crosses two trust boundaries: localStorage (can be corrupt, or
// written by an older/newer version) and the collab relay (anyone with the
// session id can send anything). Everything past these checks can assume
// elements have the shape in types.ts.

import { parseConditions } from '../conditions';
import { ID_RE } from './ids';
import type { BoardElement, ElementType, TextStyled } from './types';

type Raw = Record<string, unknown>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);

// Per type: are the fields this type needs present and the right kind?
const TYPE_CHECKS: Record<ElementType, (e: Raw) => boolean> = {
  rect: (e) => isNum(e.x) && isNum(e.y) && isNum(e.w) && isNum(e.h) && optional(e.rotation, isNum),
  wall: (e) => isNum(e.x1) && isNum(e.y1) && isNum(e.x2) && isNum(e.y2),
  token: (e) =>
    isNum(e.x) &&
    isNum(e.y) &&
    optional(e.radius, isNum) &&
    optional(e.name, isStr) &&
    optional(e.color, isStr),
  // The map's background: a colour and/or a picture. The picture's size is bounded so one bad element can't
  // make a huge box, and its id and the colour are checked here. With no picture the size is 0.
  background: (e) =>
    isNum(e.x) &&
    isNum(e.y) &&
    isNum(e.w) &&
    isNum(e.h) &&
    optional(e.opacity, isNum) &&
    optional(e.color, (c) => isStr(c) && COLOR_RE.test(c)) &&
    (e.image === undefined
      ? e.color !== undefined
      : isStr(e.image) && ID_RE.test(e.image) && e.w > 0 && e.h > 0 && e.w <= 100_000 && e.h <= 100_000),
  label: (e) => isNum(e.x) && isNum(e.y) && isStr(e.text) && optional(e.fontSize, isNum),
};

function isElement(value: unknown): value is BoardElement {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Raw;
  const check = Object.hasOwn(TYPE_CHECKS, e.type as string) && TYPE_CHECKS[e.type as ElementType];
  return (
    !!check &&
    check(e) &&
    optional(e.id, isStr) &&
    optional(e.strokeColor, isStr) &&
    optional(e.fillColor, isStr) &&
    optional(e.strokeWidth, isNum)
  );
}

// Text style flags (bold, italic, plate) are kept only when they are exactly true, as they are saved.
function withStyleFlags<T extends TextStyled>(el: T): T {
  const clean = { ...el };
  for (const key of ['bold', 'italic', 'plate'] as const) if (clean[key] !== true) delete clean[key];
  return clean;
}

// The same for locked, which any type can be.
function withLayerFlags<T extends BoardElement>(el: T): T {
  const clean = { ...el };
  if (clean.locked !== true) delete clean.locked;
  return clean;
}

// A picture's opacity is kept only if it is a usable one (above 0, up to 1; 1 is left off).
function withOpacity<T extends { opacity?: number }>(el: T): T {
  const { opacity, ...rest } = el;
  const usable = typeof opacity === 'number' && opacity > 0 && opacity < 1;
  return (usable ? { ...rest, opacity } : rest) as T;
}

// A valid element with anything inside it that isn't valid taken out, rather than the element
// dropped: a token's bad conditions are cleaned (see parseConditions) and a picture id that isn't one removed,
// and the token stays.
function tidy(input: BoardElement): BoardElement {
  const el = withLayerFlags(input);
  if (el.type === 'background') return withOpacity(el);
  if (el.type === 'label') return withStyleFlags(el);
  if (el.type !== 'token') return el;
  const { conditions: raw, image: rawImage, ...rest } = withStyleFlags(el);
  const conditions = raw === undefined ? [] : parseConditions(raw);
  return {
    ...rest,
    ...(conditions.length ? { conditions } : {}),
    ...(isStr(rawImage) && ID_RE.test(rawImage) ? { image: rawImage } : {}),
  };
}

// The valid elements in data, or null if data isn't a list at all. Invalid
// entries are dropped rather than rejecting the whole board, so one bad
// element can't cost someone their map. That includes elements of a type this
// version doesn't know.
export function parseElements(data: unknown): BoardElement[] | null {
  return Array.isArray(data) ? data.filter(isElement).map(tidy) : null;
}
