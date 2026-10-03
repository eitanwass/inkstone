// ── The named-map share card ──────────────────────────────────
// The 1200x630 link-preview card for a particular map, drawn by Satori from
// plain objects and rasterized by resvg. It mirrors design/share-preview/template.html
// (the layout used for the static site card), so change them together.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori from 'satori';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const INK = '#4a3f2e';
const PARCHMENT = '#e9e4da';

// Fonts are read from the bundled @fontsource packages (WOFF; Satori can't read
// WOFF2 or variable fonts). Latin and Latin Extended cover most European
// languages.
const INTER = 'node_modules/@fontsource/inter/files';
const GARAMOND = 'node_modules/@fontsource/eb-garamond/files';

const FONTS = [
  { name: 'EB Garamond', weight: 500, file: `${GARAMOND}/eb-garamond-latin-500-normal.woff` },
  { name: 'EB Garamond', weight: 500, file: `${GARAMOND}/eb-garamond-latin-ext-500-normal.woff` },
  ...([400, 600, 700] as const).flatMap((weight) => [
    { name: 'Inter', weight, file: `${INTER}/inter-latin-${weight}-normal.woff` },
    { name: 'Inter', weight, file: `${INTER}/inter-latin-ext-${weight}-normal.woff` },
  ]),
] as const;

const WASM_FILE = 'node_modules/@resvg/resvg-wasm/index_bg.wasm';
const LOGO_FILE = 'public/logo.svg';
// Not read by us: satori's text shaper (harfbuzzjs) loads it from disk when it starts, and
// the function crashed on Vercel without it.
const HARFBUZZ_WASM = 'node_modules/harfbuzzjs/hb.wasm';

// Every file this module reads at runtime, relative to the project root.
// vercel.json's `includeFiles` for the function must cover all of them (a test
// checks that they exist and are listed there).
export const RUNTIME_FILES: readonly string[] = [
  ...FONTS.map((f) => f.file),
  WASM_FILE,
  HARFBUZZ_WASM,
  LOGO_FILE,
];

const read = (file: string) => readFileSync(join(process.cwd(), file));

function loadFonts() {
  return FONTS.map((f) => ({ name: f.name, weight: f.weight, style: 'normal' as const, data: read(f.file) }));
}

// The map's dot grid as a repeating tile (Satori doesn't draw a CSS radial-gradient grid).
const DOT_TILE =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="2.6" fill="rgb(180,170,155)" fill-opacity="0.75"/></svg>',
  ).toString('base64');

function logoDataUri(): string {
  return `data:image/svg+xml;base64,${read(LOGO_FILE).toString('base64')}`;
}

// Whether every character of a name is one the bundled fonts can draw: Basic Latin
// (letters, digits, punctuation), Latin-1 and Latin Extended-A/B (accents and
// the like), typographic punctuation (curly quotes, dashes, ellipsis, bullets) and
// the euro sign. Anything else (another script, emoji) would render as an empty
// box, so the caller shows the plain site card instead. This is an explicit list
// of ranges on purpose: broad Unicode categories such as "symbols" include emoji.
export function isDrawable(name: string): boolean {
  return /^[\u0020-\u007e\u00a0-\u024f\u2010-\u2027\u2030-\u205e\u20ac]+$/.test(name);
}

// The biggest name size that should fit in the 600x230 box, from how long the
// name is. Satori can't measure text, so this is a deliberately cautious estimate
// (about half an em per character); the box clips whatever still overflows.
export function nameFontSize(name: string): number {
  for (let size = 112; size > 44; size -= 4) {
    const charsPerLine = Math.max(1, Math.floor(600 / (size * 0.52)));
    const lines = Math.ceil(name.length / charsPerLine);
    if (lines * size * 1.04 <= 230) return size;
  }
  return 44;
}

type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: unknown): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

export function namedCard(name: string): Node {
  const abs = (style: Record<string, unknown>, children?: unknown) =>
    box({ position: 'absolute', ...style }, children);
  const token = (x: number, y: number, color: string, rim: string, initials: string, label: string) => [
    abs(
      {
        left: x - 38,
        top: y - 38,
        width: 76,
        height: 76,
        borderRadius: 38,
        background: color,
        border: `3px solid ${rim}`,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 30,
        fontWeight: 700,
      },
      initials,
    ),
    abs(
      {
        left: x - 80,
        top: y + 46,
        width: 160,
        justifyContent: 'center',
        color: '#fff',
        fontSize: 19,
        fontWeight: 400,
      },
      label,
    ),
  ];

  return box(
    {
      position: 'relative',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      background: PARCHMENT,
      backgroundImage: `url(${DOT_TILE})`,
      backgroundSize: '60px 60px',
      backgroundRepeat: 'repeat',
      fontFamily: 'Inter',
      color: INK,
    },
    [
      // the lockup
      abs({ left: 80, top: 64, alignItems: 'center' }, [
        { type: 'img', props: { src: logoDataUri(), width: 56, height: 56 } },
        box(
          {
            marginLeft: 16,
            fontFamily: 'EB Garamond',
            fontWeight: 500,
            fontSize: 60,
            letterSpacing: '0.02em',
            lineHeight: 1,
          },
          'Inkstone',
        ),
      ]),
      // the "Live map" pill
      abs(
        {
          left: 80,
          top: 196,
          alignItems: 'center',
          padding: '9px 20px 9px 16px',
          background: '#1a1714',
          borderRadius: 999,
          color: '#e8dcc8',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        },
        [box({ width: 14, height: 14, borderRadius: 7, background: '#e5484d', marginRight: 12 }), 'Live map'],
      ),
      // the map's name, the hero
      abs(
        { left: 80, top: 262, width: 600, height: 230, overflow: 'hidden' },
        box(
          {
            fontFamily: 'EB Garamond',
            fontWeight: 500,
            fontSize: nameFontSize(name),
            lineHeight: 1.04,
            letterSpacing: '0.01em',
            color: '#2e261a',
            wordBreak: 'break-word',
          },
          name,
        ),
      ),
      abs({ left: 80, top: 520, fontSize: 28, color: '#6b5f50' }, 'Join this map on Inkstone'),
      // a small map, bleeding off the corner
      abs({
        left: 720,
        top: 250,
        width: 420,
        height: 300,
        background: '#463b29',
        border: '8px solid #e8dcc8',
      }),
      abs({ left: 1140, top: 395, width: 100, height: 10, background: INK }),
      abs(
        { left: 720, top: 268, width: 420, justifyContent: 'center', color: '#e8dcc8', fontSize: 24 },
        'Throne Room',
      ),
      ...token(840, 365, '#e05c5c', '#f3a3a3', 'AR', 'Aragorn'),
      ...token(1020, 460, '#5c8ae0', '#a9c1f1', 'GO', 'Gimli'),
    ],
  );
}

let wasmReady: Promise<void> | undefined;
function ensureWasm(): Promise<void> {
  wasmReady ??= initWasm(read(WASM_FILE));
  return wasmReady;
}

// The card for a map as PNG bytes. Satori lays it out into an SVG (with the text
// already turned into outlines, so the renderer needs no fonts), and resvg draws
// that to a PNG.
export async function renderCard(name: string): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(namedCard(name) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: loadFonts(),
  });
  await ensureWasm();
  // copied into a fresh buffer so it can be handed straight to a Response/Blob
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng());
}
