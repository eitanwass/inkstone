// ── Players' names ─────────────────────────────────────────────
// What someone in a shared map is called: chosen by them, or suggested from two lists of fantasy words
// ("Crimson Owl"). Pure, so it is unit tested. The name is only a label: the player is their id.

// Someone in a shared map, you included: who they are (a random id, kept in their browser) and what they
// are called.
export type Player = { id: string; name: string };

export const PLAYER_NAME_MAX = 40; // the relay's limit too (party/server.js)

const ADJECTIVES = [
  'Crimson',
  'Gilded',
  'Wandering',
  'Ashen',
  'Hollow',
  'Quiet',
  'Silver',
  'Ember',
  'Frost',
  'Mossy',
  'Thorned',
  'Veiled',
  'Sable',
  'Amber',
  'Ivory',
  'Stormborn',
  'Rustic',
  'Brazen',
  'Cunning',
  'Dusky',
  'Fabled',
  'Gallant',
  'Hushed',
  'Iron',
  'Jade',
  'Keen',
  'Lunar',
  'Misty',
  'Nimble',
  'Oaken',
  'Pale',
  'Restless',
];

const NOUNS = [
  'Owl',
  'Fox',
  'Bard',
  'Warden',
  'Stag',
  'Cartographer',
  'Raven',
  'Wolf',
  'Tinker',
  'Sage',
  'Hound',
  'Magpie',
  'Rogue',
  'Herald',
  'Badger',
  'Scribe',
  'Heron',
  'Lantern',
  'Falconer',
  'Wyrm',
  'Alchemist',
  'Pilgrim',
  'Stoat',
  'Archer',
  'Drifter',
  'Mason',
  'Seer',
  'Thrush',
  'Ranger',
  'Hermit',
  'Marten',
  'Cleric',
];

export const NAME_COMBINATIONS = ADJECTIVES.length * NOUNS.length;

// A name made from one word of each list. Never `avoid` (the one being replaced), so a shuffle always
// changes it. `random` is a source of numbers from 0 up to 1, replaceable for tests.
export function randomPlayerName(avoid = '', random: () => number = Math.random): string {
  const pick = (words: string[]) => words[Math.floor(random() * words.length)];
  let name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  for (let tries = 0; name === avoid && tries < 10; tries++) name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  return name;
}

// Text typed as a name, tidied: control characters removed, runs of whitespace made one space, trimmed,
// and cut to the limit. Empty if nothing usable is left.
export function normalizePlayerName(text: unknown): string {
  if (typeof text !== 'string') return '';
  const tidy = text
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return tidy.slice(0, PLAYER_NAME_MAX).trim();
}
