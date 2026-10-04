// ── Board data validation ─────────────────────────────────────
// Board data crosses two trust boundaries: localStorage (can be corrupt, or
// written by an older/newer version) and the collab relay (anyone with the
// session id can send anything). Everything past these checks can assume
// elements have the shape in types.ts.

import { parseConditions } from './conditions';
import { normalizeMapName } from './map-name-text';
import type { BoardElement, BoardSnapshot, ElementType } from './types';

type Raw = Record<string, unknown>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
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
  label: (e) => isNum(e.x) && isNum(e.y) && isStr(e.text) && optional(e.fontSize, isNum),
};

function isElement(value: unknown): value is BoardElement {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Raw;
  const check = Object.hasOwn(TYPE_CHECKS, e.type as string) && TYPE_CHECKS[e.type as ElementType];
  return (
    !!check &&
    check(e) &&
    optional(e.strokeColor, isStr) &&
    optional(e.fillColor, isStr) &&
    optional(e.strokeWidth, isNum)
  );
}

// A valid element with anything inside it that isn't valid taken out, rather than the element
// dropped: a token's bad conditions are cleaned (see parseConditions), and the token stays.
function tidy(el: BoardElement): BoardElement {
  if (el.type !== 'token' || el.conditions === undefined) return el;
  const { conditions: _dropped, ...rest } = el;
  const conditions = parseConditions(el.conditions);
  return conditions.length ? { ...rest, conditions } : rest;
}

// The valid elements in data, or null if data isn't a list at all. Invalid
// entries are dropped rather than rejecting the whole board, so one bad
// element can't cost someone their map. That includes elements of a type this
// version doesn't know.
export function parseElements(data: unknown): BoardElement[] | null {
  return Array.isArray(data) ? data.filter(isElement).map(tidy) : null;
}

// What a collaborator's message holds: either the current format, an object with
// the elements and the map's name, or the older one, just the list of elements
// (which says nothing about the name, so no name is returned for it). A name that
// isn't text is ignored rather than rejecting the whole message. Null if there
// is no usable list of elements at all.
export function parseSnapshot(data: unknown): BoardSnapshot | null {
  if (Array.isArray(data)) return { elements: data.filter(isElement).map(tidy) };
  if (typeof data !== 'object' || data === null) return null;
  const { elements, name } = data as Raw;
  const parsed = parseElements(elements);
  if (!parsed) return null;
  return typeof name === 'string' ? { elements: parsed, name: normalizeMapName(name) } : { elements: parsed };
}
