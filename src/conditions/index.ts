// ── Conditions ─────────────────────────────────────────────────
// A condition is something a creature is under: Prone, Poisoned, or one a player made up
// ("Hexed"). It is an object, not a word: it has a name, a color and an icon. A token carries the
// whole objects (see TokenElement.conditions), so a token is complete in itself: it saves, syncs to
// the others in a session and duplicates with its conditions, whether or not they have the same
// custom conditions in their settings.
//
// Pure data and checks, no DOM: the default set, the icon library, and what counts as a valid one.

export interface Condition {
  id: string;
  name: string;
  color: string; // #rrggbb
  icon: string; // a key of ICONS
}

// An icon is one stroked outline, drawn in a 24 by 24 box with a round white line. The same path is
// drawn on the canvas (as a Path2D) and in the page (as an <svg> path), so there is one copy of each.
export interface IconSpec {
  d: string;
  dash?: number[]; // a dashed line, in the same 24-unit box
}

// What an icon file says: its path, and its dash pattern if the line is dashed. A file is a plain,
// standalone SVG (open it in any viewer or editor) with exactly one <path>; the line styling is on
// the <svg>, and a dashed line has `stroke-dasharray` on the path. Throws on one that isn't, so a
// broken file fails the build's tests rather than drawing nothing.
export function parseIconSvg(svg: string): IconSpec {
  const paths = svg.match(/<path\b[^>]*>/g) ?? [];
  if (paths.length !== 1) throw new Error(`an icon is exactly one <path>, this has ${paths.length}`);
  const d = /\sd="([^"]+)"/.exec(paths[0])?.[1];
  if (!d) throw new Error('the icon\'s <path> has no d="…"');
  const dashText = /\sstroke-dasharray="([^"]+)"/.exec(paths[0])?.[1];
  if (!dashText) return { d };
  const dash = dashText
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!dash.every((n) => Number.isFinite(n) && n > 0)) throw new Error(`bad dash pattern "${dashText}"`);
  return { d, dash };
}

// The icon library: one SVG file per icon in src/conditions/icons/, named for the icon (`moon.svg` is
// `moon`). They are read when the app is built, so there is nothing to fetch while it runs. The
// first sixteen are the default conditions', the rest are there for the ones players make.
const files = import.meta.glob<string>('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const ICONS: Record<string, IconSpec> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => {
    const name = /([^/]+)\.svg$/.exec(path)?.[1] ?? path;
    return [name, parseIconSvg(svg)];
  }),
);

export const ICON_NAMES: readonly string[] = Object.keys(ICONS);

// A dead token is drawn greyed out and crossed through, not with a badge, so the code that draws
// tokens needs to know which condition that is.
export const DEAD_ID = 'dead';

// The sixteen from the 5e rules, plus Dead. Each has its own shape and hue, so the color is never the
// only way to tell them apart.
export const DEFAULT_CONDITIONS: readonly Condition[] = [
  { id: 'blinded', name: 'Blinded', color: '#5b6577', icon: 'eye-off' },
  { id: 'charmed', name: 'Charmed', color: '#c0267a', icon: 'heart' },
  { id: 'deafened', name: 'Deafened', color: '#6d6a5f', icon: 'ear-off' },
  { id: 'exhaustion', name: 'Exhaustion', color: '#8f5a1a', icon: 'battery' },
  { id: 'frightened', name: 'Frightened', color: '#c2610c', icon: 'alert' },
  { id: 'grappled', name: 'Grappled', color: '#0f766e', icon: 'rings' },
  { id: 'incapacitated', name: 'Incapacitated', color: '#a3322e', icon: 'pause' },
  { id: 'invisible', name: 'Invisible', color: '#475569', icon: 'dashed-circle' },
  { id: 'paralyzed', name: 'Paralyzed', color: '#a16207', icon: 'bolt' },
  { id: 'petrified', name: 'Petrified', color: '#57534e', icon: 'gem' },
  { id: 'poisoned', name: 'Poisoned', color: '#2f7d32', icon: 'drop' },
  { id: 'prone', name: 'Prone', color: '#6d4fc7', icon: 'arrow-down' },
  { id: 'restrained', name: 'Restrained', color: '#0e6f8f', icon: 'lock' },
  { id: 'stunned', name: 'Stunned', color: '#a22fb0', icon: 'sparkle' },
  { id: 'unconscious', name: 'Unconscious', color: '#1f4fae', icon: 'zz' },
  { id: DEAD_ID, name: 'Dead', color: '#7f1d1d', icon: 'cross' },
];

export const DEFAULT_IDS: ReadonlySet<string> = new Set(DEFAULT_CONDITIONS.map((c) => c.id));

// A custom condition's id starts with this, so it can never be taken for a default one.
export const CUSTOM_PREFIX = 'custom-';

export const MAX_NAME = 20;
export const MAX_ID = 40;
// More than this on one token is no use to anyone, and keeps what a token carries small.
export const MAX_PER_TOKEN = 12;

const HEX = /^#[0-9a-f]{6}$/i;

export function isCondition(value: unknown): value is Condition {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, color, icon } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_ID &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= MAX_NAME &&
    typeof color === 'string' &&
    HEX.test(color) &&
    typeof icon === 'string' &&
    Object.hasOwn(ICONS, icon)
  );
}

// How many custom conditions a player can define.
export const MAX_CUSTOM = 40;

// The conditions in `value` that are valid, once each by id, at most `max` (a token's worth unless
// said otherwise), as clean copies (only the four fields). Anything that isn't a list gives none.
// Used for what comes from storage or from other players in a session, which can be anything.
export function parseConditions(value: unknown, max = MAX_PER_TOKEN): Condition[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Condition[] = [];
  for (const item of value) {
    if (!isCondition(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name, color: item.color.toLowerCase(), icon: item.icon });
    if (out.length === max) break;
  }
  return out;
}

// A new id for a custom condition.
export function newCustomId(): string {
  return `${CUSTOM_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
}
