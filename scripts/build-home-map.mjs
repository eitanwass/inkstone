// Renders the map shown at the top of the home page, using the editor itself.
//
//   npm run build:home-map
//
// Writes public/home-map.jpg. The map below is made of the same elements the editor saves, put in
// the browser's storage and drawn by the real app with its panels hidden, so the picture is always
// what the editor can do. Token pictures are painted here and kept in the editor's own image store,
// the way a picture a player chose would be. Don't edit the JPG by hand: change the map here and run
// this again.

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const C = 40; // one map cell
const PARCHMENT = '#e8dcc8';

// A floor. Its outline takes the floor's own colour: the walls are drawn over it, with doorways.
const room = (x, y, w, h, fillColor, extra = {}) => ({
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
const furniture = (x, y, w, h, fillColor, extra = {}) =>
  room(x, y, w, h, fillColor, { strokeColor: PARCHMENT, strokeWidth: 3, ...extra });

const wall = (x1, y1, x2, y2) => ({
  type: 'wall',
  x1: x1 * C,
  y1: y1 * C,
  x2: x2 * C,
  y2: y2 * C,
  strokeColor: PARCHMENT,
  strokeWidth: 6,
});
// A straight wall from `from` to `to` along one axis, with doorways (gaps) left open in it.
function wallWithDoors(horizontal, fixed, from, to, doors = []) {
  const walls = [];
  let start = from;
  for (const [a, b] of [...doors].sort((p, q) => p[0] - q[0])) {
    walls.push(horizontal ? wall(start, fixed, a, fixed) : wall(fixed, start, fixed, a));
    start = b;
  }
  walls.push(horizontal ? wall(start, fixed, to, fixed) : wall(fixed, start, fixed, to));
  return walls;
}

const label = (x, y, text, fontSize = 22, extra = {}) => ({
  type: 'label',
  x: x * C,
  y: y * C,
  text,
  fontSize,
  strokeColor: PARCHMENT,
  ...extra,
});
// `portrait` names a picture painted below; it becomes the token's image.
const token = (x, y, name, color, extra = {}) => ({
  type: 'token',
  x: x * C,
  y: y * C,
  radius: 20,
  name,
  color,
  ...extra,
});
const condition = (id, name, color, icon) => ({ id, name, color, icon });
const poisoned = condition('poisoned', 'Poisoned', '#2f7d32', 'drop');
const prone = condition('prone', 'Prone', '#6d4fc7', 'arrow-down');
const frightened = condition('frightened', 'Frightened', '#c2610c', 'alert');
const charmed = condition('charmed', 'Charmed', '#c0267a', 'heart');
const dead = condition('dead', 'Dead', '#7f1d1d', 'cross');

const pillar = (x, y) => furniture(x, y, 1, 1, '#7a6c55');

const BOARD = [
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
function paintPortraits(kinds) {
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

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 740 }, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:5199/draw/');
  await page.evaluate(
    async ({ board, paintSource }) => {
      localStorage.clear();
      // The pictures go through the editor's own image store, so a token holds only an id.
      const { addImage } = await import('/src/elements/token-image.ts');
      const paint = new Function(`return (${paintSource})`)();
      const kinds = [...new Set(board.flatMap((el) => (el.portrait ? [el.portrait] : [])))];
      const pictures = paint(kinds);
      for (const el of board) {
        if (!el.portrait) continue;
        el.image = addImage(pictures[el.portrait]);
        delete el.portrait;
      }
      localStorage.setItem('inkstone-board', JSON.stringify(board));
      localStorage.setItem('inkstone-hint-seen', '1');
      localStorage.setItem('inkstone-player', JSON.stringify({ id: 'homepage01', name: 'Mira' }));
    },
    { board: BOARD, paintSource: paintPortraits.toString() },
  );
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.addStyleTag({
    content: 'header, nav, footer, #toast, #first-visit-hint, #hud { display: none !important; }',
  });
  await page.keyboard.press('f'); // fit the whole map
  for (let i = 0; i < 1; i++) await page.keyboard.press('+'); // closer: the fit leaves wide margins
  await page.waitForTimeout(800); // the fonts and the pictures
  await page.screenshot({ path: 'public/home-map.jpg', type: 'jpeg', quality: 86 });
  console.log('Wrote public/home-map.jpg');
} finally {
  await browser.close();
  await server.close();
}
