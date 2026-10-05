// ── The conditions a player can choose from ────────────────────
// The default ones, plus any they have made up in Settings. The custom ones are kept in this
// browser (under `inkstone-conditions`), not in the map: a token carries its own copy of whatever
// conditions it has (see index.ts), so a map shows right on anyone's screen.

import { storageGet, storageSet } from '../core/storage';
import {
  type Condition,
  CUSTOM_PREFIX,
  DEFAULT_CONDITIONS,
  isCondition,
  MAX_CUSTOM,
  newCustomId,
  parseConditions,
} from './index';

const STORAGE_KEY = 'inkstone-conditions';

// What is kept: valid conditions with a custom id, so nothing stored by hand can pose as a default.
function load(): Condition[] {
  try {
    const saved = parseConditions(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'), MAX_CUSTOM);
    return saved.filter((c) => c.id.startsWith(CUSTOM_PREFIX));
  } catch {
    return [];
  }
}

let custom: Condition[] = load();

function save(): void {
  storageSet(STORAGE_KEY, JSON.stringify(custom)); // if storage is unavailable, they last this visit
}

export const customConditions = (): readonly Condition[] => custom;
export const allConditions = (): Condition[] => [...DEFAULT_CONDITIONS, ...custom];

// What a player fills in to make one.
export interface Draft {
  name: string;
  color: string;
  icon: string;
}

// Is this name already a condition's, ignoring capitals? (`exceptId` is the one being edited.)
export function nameTaken(name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return allConditions().some((c) => c.id !== exceptId && c.name.toLowerCase() === wanted);
}

// Why a draft can't be used, or null if it can. (The form shows this.)
export function draftProblem(draft: Draft, exceptId?: string): string | null {
  const name = draft.name.trim();
  if (!name) return 'Give it a name.';
  if (nameTaken(name, exceptId)) return 'There is already a condition with that name.';
  if (!isCondition({ id: 'check', name, color: draft.color, icon: draft.icon }))
    return 'Choose a color and an icon.';
  if (!exceptId && custom.length >= MAX_CUSTOM) return `You can have up to ${MAX_CUSTOM} of your own.`;
  return null;
}

// Makes one and keeps it. Null if the draft can't be used (see draftProblem).
export function addCustom(draft: Draft): Condition | null {
  if (draftProblem(draft)) return null;
  const made: Condition = {
    id: newCustomId(),
    name: draft.name.trim(),
    color: draft.color.toLowerCase(),
    icon: draft.icon,
  };
  custom = [...custom, made];
  save();
  return made;
}

// Changes one of their own, keeping its id (so the tokens that have it can be brought up to date).
export function updateCustom(id: string, draft: Draft): Condition | null {
  const index = custom.findIndex((c) => c.id === id);
  if (index < 0 || draftProblem(draft, id)) return null;
  const changed: Condition = {
    id,
    name: draft.name.trim(),
    color: draft.color.toLowerCase(),
    icon: draft.icon,
  };
  custom = custom.map((c, i) => (i === index ? changed : c));
  save();
  return changed;
}

// Forgets one of their own. Tokens that already have it keep it.
export function removeCustom(id: string): void {
  custom = custom.filter((c) => c.id !== id);
  save();
}
