// ── What the relay sends us ─────────────────────────────────────
// Four kinds of message come from the relay, and anyone with the session id could send any of them
// (the relay checks their shape, but the contents are checked here again). `rev` is the room's
// revision (the count of accepted batches of changes) and `epoch` names this life of the room.
//   doc      the whole map, when we have nothing to be caught up from. `fresh` means nobody has used
//            this room yet (it is new, or has expired), so our own map becomes the room's.
//   catchup  the room's version of whatever changed while we were away
//   changes  what someone else changed (see changes.ts), as revision `rev`
//   image    a picture we asked for (see `getimages` in collab.ts), by its id
//   presence who is connected: `count` people, `people` the first few ({ id, name })
//   ack      our batch was received: the room is now at `rev`, and `fix` is the room's version of
//            anything of ours that it refused (someone else changed it first)
// A change that isn't valid is dropped on its own, so one bad element can't cost anyone the rest.

import type { BoardElement } from '../core/types';
import { parseElements } from '../core/validate';
import { normalizeMapName } from '../ui/map-name-text';
import { type Change, ID_RE } from './changes';

export type Message =
  | { type: 'doc'; fresh: boolean; epoch: string; rev: number; name: string; elements: BoardElement[] }
  | { type: 'catchup'; epoch: string; rev: number; changes: Change[] }
  | { type: 'changes'; rev: number; changes: Change[] }
  | { type: 'ack'; epoch: string; rev: number; fix: Change[] }
  | { type: 'image'; id: string; data: string }
  | { type: 'presence'; count: number; people: Person[] };

export type Person = { id: string; name: string };

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
const isRev = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isEpoch = (v: unknown): v is string => v === '' || isId(v);

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

const parseChanges = (data: unknown): Change[] | null =>
  Array.isArray(data) ? data.flatMap((c) => parseChange(c) ?? []) : null;

export function parseMessage(data: unknown): Message | null {
  if (isObject(data) && data.type === 'presence') {
    if (!isRev(data.count) || !Array.isArray(data.people)) return null;
    const people = data.people.flatMap((p): Person[] =>
      isObject(p) && isId(p.id) && typeof p.name === 'string'
        ? [{ id: p.id, name: p.name.slice(0, 40) }]
        : [],
    );
    return { type: 'presence', count: data.count, people };
  }
  if (isObject(data) && data.type === 'image') {
    // What the picture is, and that it matches its id, is checked when it is stored (receiveImage).
    return isId(data.id) && typeof data.data === 'string'
      ? { type: 'image', id: data.id, data: data.data }
      : null;
  }
  if (!isObject(data) || !isRev(data.rev)) return null;
  const rev = data.rev;
  if (data.type === 'changes') {
    const changes = parseChanges(data.changes);
    return changes && { type: 'changes', rev, changes };
  }
  if (!isEpoch(data.epoch)) return null;
  const epoch = data.epoch;
  if (data.type === 'doc') {
    const elements = parseElements(data.elements);
    if (!elements) return null;
    const name = typeof data.name === 'string' ? normalizeMapName(data.name) : '';
    return { type: 'doc', fresh: data.fresh === true, epoch, rev, name, elements };
  }
  if (data.type === 'catchup') {
    const changes = parseChanges(data.changes);
    return changes && { type: 'catchup', epoch, rev, changes };
  }
  if (data.type === 'ack') {
    const fix = parseChanges(data.fix);
    return fix && { type: 'ack', epoch, rev, fix };
  }
  return null;
}
