// ── Who you are ────────────────────────────────────────────────
// A random id, made once and kept in this browser (so you are the same player in every session), and a
// name you chose, empty until you have (see ui/name-dialog.tsx). The id is who you are; the name is a
// label. Both are told to the room when connecting (collab.ts), and the room's log says who sent what.

import { normalizePlayerName, type Player } from '../core/player-name';
import { storageGet, storageSet } from '../core/storage';
import { ID_RE } from './changes';

const PLAYER_KEY = 'inkstone-player';

function parse(text: string | null): { id?: unknown; name?: unknown } | null {
  try {
    const data = JSON.parse(text ?? '');
    return typeof data === 'object' && data !== null ? data : null;
  } catch {
    return null;
  }
}

const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 12);

export const me: Player = (() => {
  const saved = parse(storageGet(PLAYER_KEY));
  const id = typeof saved?.id === 'string' && ID_RE.test(saved.id) ? saved.id : newId();
  return { id, name: normalizePlayerName(saved?.name) };
})();
storageSet(PLAYER_KEY, JSON.stringify(me));

export const hasName = (): boolean => me.name !== '';

const listeners: (() => void)[] = [];
export function onNameChanged(fn: () => void): void {
  listeners.push(fn);
}

// Keeps a new name (tidied); false if nothing usable was given, and then nothing changes.
export function setName(text: string): boolean {
  const name = normalizePlayerName(text);
  if (!name) return false;
  if (name === me.name) return true;
  me.name = name;
  storageSet(PLAYER_KEY, JSON.stringify(me));
  for (const fn of listeners) fn();
  return true;
}
