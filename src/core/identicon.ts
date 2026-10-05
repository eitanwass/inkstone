// ── Identicons ─────────────────────────────────────────────────
// A person's picture until they can choose one: a sigil on a dark tile, made from a seed (their id) so
// the same person looks the same to everyone. It is the logo's own idea: a compass bezel with a tick for
// each fold, and a ring of two-tone nib-shaped petals around the middle, turned 3 to 8 times. A ring of
// dots or strokes between the petals and a ring or dot at the centre vary it, and the colour is one of
// the token colours, so a person's sigil can later match their tokens. Pure, so it is unit tested; the
// page draws it in ui/people.ts. Coordinates are in a box from -10 to 10, the tile a circle of radius 10.

export const TOKEN_COLORS = [
  '#e05c5c',
  '#5c8ae0',
  '#5cba6a',
  '#e0a85c',
  '#9a5ce0',
  '#5ce0d4',
  '#e05caa',
  '#c8e05c',
];

// light: filled in the colour; dark: filled in its shade; line: stroked in the colour; bezel: stroked
// in the muted tone the logo's compass ring uses.
export type Shape = { d: string; role: 'light' | 'dark' | 'line' | 'bezel' };
export type Identicon = { color: string; shade: string; fold: number; shapes: Shape[] };

export const BEZEL_RADIUS = 8.4;

// FNV-1a, then mulberry32 for a stream of numbers from it.
function stream(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

// The shade of a #rrggbb colour: the same colour, darker, for the shaded half of a petal.
function shadeOf(hex: string): string {
  const channel = (i: number) =>
    Math.round(Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * 0.6)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

type Point = [number, number];

const rot = ([x, y]: Point, a: number): Point => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const at = (p: Point, a: number) => rot(p, a).map(num).join(' ');
const polygon = (points: Point[], a: number) => `M${points.map((p) => at(p, a)).join('L')}Z`;
const segment = (p: Point, q: Point, a: number) => `M${at(p, a)}L${at(q, a)}`;
// A circle as path data: two half-turns.
const circle = (c: Point, r: number, a = 0) => {
  const [x, y] = rot(c, a);
  return `M${num(x - r)} ${num(y)}a${r} ${r} 0 1 0 ${num(2 * r)} 0a${r} ${r} 0 1 0 ${num(-2 * r)} 0`;
};

export function identicon(seed: string): Identicon {
  const next = stream(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const between = (lo: number, hi: number) => lo + next() * (hi - lo);

  const color = pick(TOKEN_COLORS);
  const fold = 3 + Math.floor(next() * 6);
  const inner = between(1.9, 3); // where the petals start and end, from the centre
  const outer = between(5.2, 6.8);
  const half = between(0.9, 1.7); // how wide a petal is, either side of its middle line
  const between_ = pick(['dots', 'strokes', 'none'] as const);
  const centre = pick(['dot', 'ring'] as const);

  // `make` drawn at each of the `fold` positions round the circle, `offset` steps past the first.
  const step = (Math.PI * 2) / fold;
  const eachFold = (make: (angle: number) => string, offset = 0) =>
    Array.from({ length: fold }, (_, k) => make((k + offset) * step));

  const shapes: Shape[] = [];
  const add = (role: Shape['role'], ds: string[]) => {
    for (const d of ds) shapes.push({ d, role });
  };

  add(
    'bezel',
    eachFold((a) => segment([0, -BEZEL_RADIUS], [0, -BEZEL_RADIUS - 1.1], a)),
  );

  // A petal pointing up: a kite split down the middle, the right half in shade, like the nib.
  const tip: Point = [0, -outer];
  const base: Point = [0, -inner];
  const widest = -(inner + (outer - inner) * 0.35);
  add(
    'light',
    eachFold((a) => polygon([tip, [-half, widest], base], a)),
  );
  add(
    'dark',
    eachFold((a) => polygon([tip, [half, widest], base], a)),
  );

  // Between the petals, half a step round.
  const mid = (inner + outer) / 2;
  if (between_ === 'dots') {
    add(
      'light',
      eachFold((a) => circle([0, -mid], 0.55, a), 0.5),
    );
  } else if (between_ === 'strokes') {
    add(
      'line',
      eachFold((a) => segment([0, -(inner + 0.4)], [0, -(outer - 0.2)], a), 0.5),
    );
  }

  if (centre === 'ring') add('line', [circle([0, 0], 1.05)]);
  else add('dark', [circle([0, 0], 0.9)]);

  return { color, shade: shadeOf(color), fold, shapes };
}
