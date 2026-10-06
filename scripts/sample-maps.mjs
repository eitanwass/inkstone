// Maps for the library, and for the home page: built from the same elements the editor saves.
//
// scripts/build-library.mjs draws each one with the real editor and writes public/library/ (the map
// file, a thumbnail and index.json); scripts/build-home-map.mjs draws the first for the home page.
// To add a sample map: write its board here, add it to SAMPLES, and run `npm run build:library`.
// A token's `portrait` names a picture painted by paintPortraits (below) and becomes its image.

export const C = 40; // one map cell
export const PARCHMENT = '#e8dcc8';

// A floor. Its outline takes the floor's own colour: the walls are drawn over it, with doorways.
export const room = (x, y, w, h, fillColor, extra = {}) => ({
  type: 'rect',
  x: x * C,
  y: y * C,
  w: w * C,
  h: h * C,
  strokeColor: fillColor,
  fillColor,
  strokeWidth: 2,
  ...extra,
});
// A piece of furniture: outlined like the editor's own rooms.
export const furniture = (x, y, w, h, fillColor, extra = {}) =>
  room(x, y, w, h, fillColor, { strokeColor: PARCHMENT, strokeWidth: 3, ...extra });

export const wall = (x1, y1, x2, y2) => ({
  type: 'wall',
  x1: x1 * C,
  y1: y1 * C,
  x2: x2 * C,
  y2: y2 * C,
  strokeColor: PARCHMENT,
  strokeWidth: 6,
});
// A straight wall from `from` to `to` along one axis, with doorways (gaps) left open in it.
export function wallWithDoors(horizontal, fixed, from, to, doors = []) {
  const walls = [];
  let start = from;
  for (const [a, b] of [...doors].sort((p, q) => p[0] - q[0])) {
    walls.push(horizontal ? wall(start, fixed, a, fixed) : wall(fixed, start, fixed, a));
    start = b;
  }
  walls.push(horizontal ? wall(start, fixed, to, fixed) : wall(fixed, start, fixed, to));
  return walls;
}

export const label = (x, y, text, fontSize = 22, extra = {}) => ({
  type: 'label',
  x: x * C,
  y: y * C,
  text,
  fontSize,
  strokeColor: PARCHMENT,
  ...extra,
});
// `portrait` names a picture painted below; it becomes the token's image.
export const token = (x, y, name, color, extra = {}) => ({
  type: 'token',
  x: x * C,
  y: y * C,
  radius: 20,
  name,
  color,
  ...extra,
});
export const condition = (id, name, color, icon) => ({ id, name, color, icon });
export const poisoned = condition('poisoned', 'Poisoned', '#2f7d32', 'drop');
export const prone = condition('prone', 'Prone', '#6d4fc7', 'arrow-down');
export const frightened = condition('frightened', 'Frightened', '#c2610c', 'alert');
export const charmed = condition('charmed', 'Charmed', '#c0267a', 'heart');
export const dead = condition('dead', 'Dead', '#7f1d1d', 'cross');

export const pillar = (x, y) => furniture(x, y, 1, 1, '#7a6c55');

export const HALL_KEEP = [
  // Floors
  room(0, 0, 22, 13, '#463b29'), // great hall
  room(-9, 3, 9, 7, '#564837'), // west tower
  room(22, 0, 14, 8, '#433b31'), // east wing
  room(22, 8, 14, 5, '#564837'), // armory
  room(3, 13, 14, 7, '#364c3f'), // garden
  room(19, 13, 10, 7, '#333e4e'), // pool

  // Furniture
  furniture(6, 5, 10, 2, '#7a5c3a', { strokeColor: '#8b5e3c' }), // long table
  furniture(17, 4, 4, 5, '#5a3030', { strokeColor: '#c9a84c' }), // dais
  furniture(7, 15, 5, 1, '#7a6c55', { rotation: 0.5 }), // a fallen beam
  furniture(21, 15.5, 6, 1, '#7a5c3a', { strokeColor: '#8b5e3c' }), // a bridge over the pool
  ...[
    [3, 2],
    [3, 10],
    [9, 2],
    [9, 10],
    [14, 2],
    [14, 10],
  ].map(([x, y]) => pillar(x, y)),

  // Walls, with doorways
  ...wallWithDoors(true, 0, 0, 36), // top
  ...wallWithDoors(false, 0, 0, 13, [[6, 8]]), // hall to the west, the tower's door
  ...wallWithDoors(true, 3, -9, 0), // tower, top
  ...wallWithDoors(true, 10, -9, 0), // tower, bottom
  ...wallWithDoors(false, -9, 3, 10), // tower, west
  ...wallWithDoors(true, 13, 0, 36, [
    [8, 10], // into the garden
    [20, 21.5], // down to the pool
    [25, 27], // the armory to the pool
  ]),
  ...wallWithDoors(false, 22, 0, 13, [
    [3, 5], // hall to barracks
    [10, 12], // hall to armory
  ]),
  ...wallWithDoors(false, 36, 0, 13), // east
  ...wallWithDoors(false, 28, 0, 8, [[3, 5]]), // barracks to the east wing
  ...wallWithDoors(true, 8, 22, 36, [
    [24, 26],
    [32, 33.5],
  ]),
  ...wallWithDoors(true, 10, 22, 36, [[26, 30]]),
  ...wallWithDoors(false, 3, 13, 20), // garden, west
  ...wallWithDoors(false, 17, 13, 20), // garden, east
  ...wallWithDoors(true, 20, 3, 17), // garden, south
  ...wallWithDoors(false, 19, 13, 20), // pool, west
  ...wallWithDoors(false, 29, 13, 20), // pool, east
  ...wallWithDoors(true, 20, 19, 29), // pool, south

  // Labels
  label(1, 0.5, 'Great Hall', 26),
  label(-8.5, 3.5, 'Tower', 20),
  label(23, 0.5, 'Barracks', 20),
  label(23, 8.5, 'Armory', 20),
  label(4, 13.5, 'Overgrown Garden', 20),
  label(20, 13.5, 'The Drowned Pool', 20),
  label(17.5, 3, 'Throne', 18),

  // The party
  token(7.5, 3.5, 'Mira', '#5c8ae0', { portrait: 'mage' }),
  token(5.5, 8.5, 'Torvald', '#5cba6a', { portrait: 'knight' }),
  token(11.5, 8.5, 'Kess', '#5ce0d4', { portrait: 'ranger' }),
  token(12.5, 3.5, 'Bran', '#9a5ce0', { conditions: [poisoned] }),
  token(-4.5, 6.5, 'Elric', '#c8e05c', { conditions: [charmed] }),

  // Whatever has come to meet them
  token(25.5, 2.5, 'Goblin 1', '#e0a85c', { portrait: 'goblin' }),
  token(31.5, 1.5, 'Goblin 2', '#e0a85c', { portrait: 'goblin', conditions: [prone] }),
  token(31.5, 6.5, 'Goblin 3', '#e0a85c', { portrait: 'goblin' }),
  token(33, 4, 'Ogre Brute', '#e05c5c', { radius: 40, portrait: 'ogre', conditions: [frightened] }),
  token(9.5, 17.5, 'Wraith', '#e05caa', { portrait: 'wraith' }),
  token(26.5, 18, 'Sahuagin', '#5ce0d4', { conditions: [frightened] }),
  token(26.5, 11.5, 'Guard', '#e0a85c', { conditions: [dead] }),
  token(22.5, 5.5, 'Goblin 4', '#e0a85c'),
];

// Runs in the page: paints a small portrait for each kind and returns it as a data URL.
export function paintPortraits(kinds) {
  const looks = {
    mage: { bg: ['#3d5a9c', '#1b2440'], cloth: '#2f4a8a', skin: '#e7bd96' },
    knight: { bg: ['#6f7f6a', '#2a332a'], cloth: '#8e949b', skin: '#d8a982' },
    ranger: { bg: ['#3f8f88', '#14312f'], cloth: '#34553a', skin: '#c9946b' },
    goblin: { bg: ['#9c6a2a', '#35230f'], cloth: '#5a3a1e', skin: '#7fa24a' },
    ogre: { bg: ['#a84a3c', '#3a1511'], cloth: '#6b4a2e', skin: '#8fa064' },
    wraith: { bg: ['#8a4a8a', '#1c0f22'], cloth: '#241630', skin: '#cfc2e8' },
  };
  const paint = (kind) => {
    const { bg, cloth, skin } = looks[kind];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const glow = g.createRadialGradient(64, 50, 6, 64, 64, 96);
    glow.addColorStop(0, bg[0]);
    glow.addColorStop(1, bg[1]);
    g.fillStyle = glow;
    g.fillRect(0, 0, 128, 128);

    const shape = (fill, draw) => {
      g.beginPath();
      draw();
      g.fillStyle = fill;
      g.fill();
    };
    const eyes = (color, y = 62, gap = 11, r = 3.2) => {
      for (const dx of [-gap, gap]) shape(color, () => g.arc(64 + dx, y, r, 0, Math.PI * 2));
    };

    shape(cloth, () => g.ellipse(64, 138, 54, 40, 0, 0, Math.PI * 2)); // shoulders
    const big = kind === 'ogre';
    const headR = big ? 34 : 27;
    const headY = big ? 68 : 64;

    if (kind === 'goblin') {
      for (const s of [-1, 1]) {
        shape(skin, () => {
          g.moveTo(64 + s * 22, headY - 6);
          g.lineTo(64 + s * 54, headY - 22);
          g.lineTo(64 + s * 26, headY + 12);
        });
      }
    }
    if (kind === 'wraith') {
      shape('#120a18', () => g.ellipse(64, 70, 44, 52, 0, 0, Math.PI * 2)); // the hood
    }
    shape(kind === 'wraith' ? '#2a1b36' : skin, () => g.arc(64, headY, headR, 0, Math.PI * 2));

    if (kind === 'mage') {
      shape('#5b3a22', () => g.ellipse(64, 66, 31, 31, 0, Math.PI * 0.95, Math.PI * 2.05)); // hair
      shape('#243a78', () => {
        g.moveTo(34, 46);
        g.lineTo(94, 46);
        g.lineTo(70, 4);
      });
      shape('#243a78', () => g.ellipse(64, 47, 36, 8, 0, 0, Math.PI * 2));
      shape('#c9a84c', () => g.rect(40, 40, 48, 5));
      eyes('#222');
    } else if (kind === 'knight') {
      shape('#a9b0b8', () => g.arc(64, 62, 30, Math.PI, Math.PI * 2)); // helmet
      shape('#a9b0b8', () => g.rect(34, 62, 60, 8));
      shape('#8e949b', () => g.rect(60, 62, 8, 26)); // nose guard
      shape('#c0392b', () => {
        g.moveTo(64, 32);
        g.quadraticCurveTo(84, 8, 100, 30);
        g.quadraticCurveTo(80, 24, 64, 36);
      });
      eyes('#222', 76);
    } else if (kind === 'ranger') {
      shape('#34553a', () => g.arc(64, 62, 36, Math.PI * 0.85, Math.PI * 2.15)); // hood
      shape('#34553a', () => g.rect(28, 62, 10, 40));
      shape('#34553a', () => g.rect(90, 62, 10, 40));
      shape(skin, () => g.arc(64, 68, 21, 0, Math.PI * 2));
      eyes('#222', 66, 9);
    } else if (kind === 'goblin') {
      eyes('#f2e14c', 60, 12, 6);
      eyes('#222', 60, 12, 2.4);
      shape('#2a1a0a', () => g.ellipse(64, 80, 12, 6, 0, 0, Math.PI));
      for (const s of [-1, 1])
        shape('#fff', () => {
          g.moveTo(64 + s * 6, 80);
          g.lineTo(64 + s * 9, 74);
          g.lineTo(64 + s * 11, 80);
        });
    } else if (kind === 'ogre') {
      shape('#5a6a3c', () => g.rect(34, 52, 60, 7)); // brow
      eyes('#f2d64c', 64, 14, 4.5);
      eyes('#222', 64, 14, 2);
      shape('#2a1a0a', () => g.ellipse(64, 88, 20, 8, 0, 0, Math.PI));
      for (const s of [-1, 1])
        shape('#f3ecd8', () => {
          g.moveTo(64 + s * 15, 86);
          g.lineTo(64 + s * 20, 68);
          g.lineTo(64 + s * 24, 86);
        });
    } else if (kind === 'wraith') {
      eyes('#9be7ff', 66, 11, 5);
      shape('rgba(155,231,255,0.35)', () => g.arc(64, 66, 34, 0, Math.PI * 2));
    }
    return canvas.toDataURL('image/webp', 0.85).startsWith('data:image/webp')
      ? canvas.toDataURL('image/webp', 0.85)
      : canvas.toDataURL('image/jpeg', 0.85);
  };
  return Object.fromEntries(kinds.map((kind) => [kind, paint(kind)]));
}

// ── A busy tavern ──────────────────────────────────────────────
const unconscious = condition('unconscious', 'Unconscious', '#1f4fae', 'zz');
const barrel = (x, y) => furniture(x, y, 1, 1, '#7a5c3a', { strokeColor: '#8b5e3c' });
const bed = (x, y) => furniture(x, y, 2, 3, '#6a4a4a');

export const RUSTY_FLAGON = [
  // Floors
  room(0, 0, 16, 10, '#564837'), // common room
  room(16, 0, 8, 6, '#433b31'), // kitchen
  room(16, 6, 8, 4, '#463b29'), // cellar
  room(24, 0, 8, 5, '#564837'), // guest room
  room(24, 5, 8, 5, '#564837'), // guest room
  room(0, 10, 16, 5, '#364c3f'), // yard

  // Furniture
  furniture(3, 2, 1.5, 6, '#7a5c3a', { strokeColor: '#8b5e3c' }), // the bar
  furniture(8, 2, 2, 2, '#7a5c3a'),
  furniture(8, 6, 2, 2, '#7a5c3a'),
  furniture(12, 4, 2, 2, '#7a5c3a'),
  furniture(14, 0, 2, 1, '#5a3030', { strokeColor: '#c9a84c' }), // the fireplace
  furniture(22, 0, 2, 2, '#4a4a48'), // the stove
  furniture(18, 3, 3, 1.5, '#7a5c3a'), // the kitchen table
  barrel(17, 7),
  barrel(18, 7),
  barrel(22, 7),
  barrel(22, 8),
  barrel(17, 8.5),
  bed(25, 0.5),
  bed(29, 0.5),
  bed(25, 5.5),
  bed(29, 5.5),
  furniture(8, 12, 2, 2, '#8a8a82'), // the well

  // Walls, with doorways
  ...wallWithDoors(true, 0, 0, 32),
  ...wallWithDoors(true, 10, 0, 32, [[7, 9]]), // out to the yard
  ...wallWithDoors(false, 0, 0, 10, [[4, 6]]), // the front door
  ...wallWithDoors(false, 16, 0, 10, [
    [2, 4], // the kitchen
    [7, 9], // the cellar stairs
  ]),
  ...wallWithDoors(false, 24, 0, 10, [
    [1.5, 3],
    [6.5, 8],
  ]),
  ...wallWithDoors(false, 32, 0, 10),
  ...wallWithDoors(true, 6, 16, 24, [[19, 21]]),
  ...wallWithDoors(true, 5, 24, 32),
  ...wallWithDoors(false, 0, 10, 15),
  ...wallWithDoors(false, 16, 10, 15),
  ...wallWithDoors(true, 15, 0, 16, [[11, 13]]), // the gate

  // Labels
  label(1, 0.5, 'Common Room', 24),
  label(17, 0.4, 'Kitchen', 18),
  label(17, 6.2, 'Cellar', 18),
  label(25, 3.8, 'Guest Room', 14),
  label(25, 8.8, 'Guest Room', 14),
  label(1, 10.4, 'Yard', 18),

  // The party has just come in
  token(1.5, 4.5, 'Ash', '#5c8ae0', { portrait: 'mage' }),
  token(1.5, 5.5, 'Brook', '#5cba6a', { portrait: 'knight' }),
  token(2.5, 5, 'Cinder', '#5ce0d4', { portrait: 'ranger' }),

  // Who is already here
  token(5.5, 4.5, 'Mara the Barkeep', '#e0a85c'),
  token(7.5, 3.5, 'Old Tom', '#9a5ce0'),
  token(8.5, 6.5, 'Drunk Dwarf', '#c8e05c', { conditions: [poisoned] }),
  token(13.5, 5.5, 'Hooded Stranger', '#e05caa', { portrait: 'wraith' }),
  token(19.5, 1.5, 'Cook', '#e0a85c'),
  token(26, 2, 'Sleeper', '#5c8ae0', { conditions: [unconscious] }),
  token(18.5, 8.5, 'Giant Rat 1', '#e05c5c', { radius: 10 }),
  token(20.5, 7.5, 'Giant Rat 2', '#e05c5c', { radius: 10 }),
  token(21, 9, 'Giant Rat 3', '#e05c5c', { radius: 10, conditions: [frightened] }),
];

// ── A road ambush ──────────────────────────────────────────────
export const CROSSROADS_AMBUSH = [
  { type: 'background', x: 0, y: 0, w: 0, h: 0, color: '#cdd5ae' }, // grass
  room(-3, 8, 36, 3, '#c9b184'), // the road
  room(13, -3, 3, 26, '#c9b184'), // the other road
  room(20, 13, 8, 5, '#5b7fa6'), // a pond

  furniture(6, 5.2, 4, 2, '#7a5c3a', { rotation: 0.35 }), // an overturned wagon
  barrel(10.5, 6.5),
  barrel(11.5, 5.8),
  furniture(19, 2, 1, 1, '#8a8a82', { rotation: 0.3 }),
  furniture(22, 4, 1.5, 1, '#8a8a82', { rotation: -0.2 }),
  furniture(3, 13, 1, 1, '#8a8a82', { rotation: 0.6 }),

  // Trees
  token(3, 3, undefined, '#4a7c59', { radius: 40 }),
  token(6, 1.5, undefined, '#4a7c59', { radius: 40 }),
  token(1.5, 6, undefined, '#5b8a5e', { radius: 30 }),
  token(9.5, 3, undefined, '#5b8a5e', { radius: 30 }),
  token(18, 3.5, undefined, '#4a7c59', { radius: 40 }),
  token(25, 2, undefined, '#4a7c59', { radius: 40 }),
  token(27.5, 6, undefined, '#5b8a5e', { radius: 30 }),
  token(4, 14, undefined, '#4a7c59', { radius: 40 }),
  token(8, 17, undefined, '#5b8a5e', { radius: 30 }),
  token(11, 14, undefined, '#4a7c59', { radius: 40 }),
  token(17.5, 16, undefined, '#4a7c59', { radius: 40 }),

  label(14, 9, 'Crossroads', 18, { strokeColor: '#4a3f2e' }),
  label(21, 15, 'Pond', 16, { strokeColor: '#e8dcc8' }),

  // The travelers
  token(8.5, 9.5, 'Merchant', '#5c8ae0', { portrait: 'mage' }),
  token(10.5, 9.5, 'Guard 1', '#5cba6a', { portrait: 'knight' }),
  token(11.5, 10.5, 'Guard 2', '#5cba6a', { portrait: 'knight', conditions: [prone] }),
  token(6.5, 10.5, 'Mule', '#e0a85c'),

  // And whoever is waiting for them
  token(17.5, 5.5, 'Bandit 1', '#e05c5c', { portrait: 'goblin' }),
  token(19.5, 12, 'Bandit 2', '#e05c5c', { portrait: 'goblin' }),
  token(10, 13.5, 'Bandit 3', '#e05c5c', { portrait: 'goblin', conditions: [frightened] }),
  token(18, 9.5, 'Bandit Leader', '#e05caa', { portrait: 'ogre' }),
];

// What goes in the library. `name` is the map's name once opened.
export const SAMPLES = [
  {
    id: 'hall-keep',
    name: 'The Hall Keep',
    description:
      'A castle: a great hall, a tower, barracks, an armory, a garden and a pool. A party meets goblins and an ogre.',
    board: HALL_KEEP,
  },
  {
    id: 'rusty-flagon',
    name: 'The Rusty Flagon',
    description: 'A busy tavern with a kitchen, a cellar full of rats, two guest rooms and a yard.',
    board: RUSTY_FLAGON,
  },
  {
    id: 'crossroads-ambush',
    name: 'Crossroads Ambush',
    description: 'An overturned wagon at a crossroads, trees to hide in and bandits waiting.',
    board: CROSSROADS_AMBUSH,
  },
];
