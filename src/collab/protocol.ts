// ── What the relay sends us ─────────────────────────────────────
// Two kinds of message come from the relay, and anyone with the session id could send either (the
// relay checks their shape, but the contents are checked here again):
//   doc      the whole map, sent when we connect. `fresh` means nobody has used this room yet (it is
//            new, or has expired), so our own map becomes the room's.
//   changes  what someone else changed (see changes.ts)
// A change that isn't valid is dropped on its own, so one bad element can't cost anyone the rest.

import type { BoardElement } from '../core/types';
import { parseElements } from '../core/validate';
import { normalizeMapName } from '../ui/map-name-text';
import { type Change, ID_RE } from './changes';

export type Message =
  | { type: 'doc'; fresh: boolean; name: string; elements: BoardElement[] }
  | { type: 'changes'; changes: Change[] };

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

function parseChange(data: unknown): Change | null {
  if (!isObject(data)) return null;
  switch (data.t) {
    case 'set': {
      const [el] = parseElements([data.el]) ?? [];
      return el && isId(el.id) ? { t: 'set', el } : null;
    }
    case 'del':
      return isId(data.id) ? { t: 'del', id: data.id } : null;
    case 'order':
      return Array.isArray(data.ids) && data.ids.every(isId) ? { t: 'order', ids: data.ids } : null;
    case 'name':
      return typeof data.name === 'string' ? { t: 'name', name: normalizeMapName(data.name) } : null;
    default:
      return null;
  }
}

export function parseMessage(data: unknown): Message | null {
  if (!isObject(data)) return null;
  if (data.type === 'changes') {
    if (!Array.isArray(data.changes)) return null;
    return { type: 'changes', changes: data.changes.flatMap((c) => parseChange(c) ?? []) };
  }
  if (data.type === 'doc') {
    const elements = parseElements(data.elements);
    if (!elements) return null;
    return {
      type: 'doc',
      fresh: data.fresh === true,
      name: typeof data.name === 'string' ? normalizeMapName(data.name) : '',
      elements,
    };
  }
  return null;
}
