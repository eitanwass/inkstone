// ── Finding a scan's own grid ──────────────────────────────────
// For "Fit to grid" in the Adjust image panel: given the pixels of a picture of a map that has a grid printed on
// it (lines or dots), find how many pixels one square is, across and down, and where the lines run, so the
// picture can be sized and moved until its squares are ours (see `fitToGrid`).
//
// How: a printed grid is the one thing on a map that repeats at a fixed spacing. For each column of pixels, add up
// how much each pixel stands out from its neighbours two and three to either side (only lines of one polarity,
// lighter or darker than their surroundings, so the edges of walls and tables, which are steps, add nothing),
// which makes a profile along x in which every vertical line is a peak; the same down the rows for horizontal
// ones. The spacing is the smallest lag at which a profile matches itself well (autocorrelation, so a spacing of
// two squares is not taken for the grid), and the exact spacing and offset come from sliding a comb of nearby
// spacings over the profile and keeping what lines up best. The rest of the map (walls, rooms, text) is not
// periodic, so it adds noise but not a peak.
//
// The two axes are measured separately: scans made by drawing programs or image generators often have squares
// that are a little wider than tall. If the two spacings agree to within a percent they are taken as one.
//
// Pure and without the DOM, so it is unit tested; the pixels come in as a grayscale array (`toGray`).

export type GridFit = {
  periodX: number; // pixels from one vertical grid line to the next, in the picture's own pixels (not a whole number)
  periodY: number; // and from one horizontal line to the next; the same as periodX for a grid of true squares
  offsetX: number; // where the first vertical line is, in pixels from the left (0 up to periodX)
  offsetY: number; // and the first horizontal line, from the top
  confidence: number; // 0 to 1: how clearly the picture repeats. Below ~0.2 it is probably not a grid.
};

const MIN_PERIOD = 8; // pixels; a smaller square can't be told from texture
const MAX_PERIOD_FRACTION = 0.2; // of the shorter side: at least five squares have to fit
const MIN_CONFIDENCE = 0.2;
const SAME_PERIOD = 0.01; // two spacings this close (as a fraction) are one square grid

// Grayscale (0 to 255) from RGBA pixels, as ImageData gives them.
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
  }
  return gray;
}

// Which lines to look for: lighter than their surroundings (a glowing or white grid on a dark map) or darker (ink
// on paper).
type Polarity = 'light' | 'dark';

// How much each column (axis 'x') or row ('y') looks like it holds a line along it, as a profile. Each pixel is
// compared with the ones two and three pixels to either side (a thin line stands out against both, a wider
// glowing one against the farther pair); the stronger of the two counts, and only if it is the right polarity.
function lineProfile(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  axis: 'x' | 'y',
  polarity: Polarity,
): Float32Array {
  const across = axis === 'x' ? width : height; // the profile's length
  const along = axis === 'x' ? height : width;
  const profile = new Float32Array(across);
  const at = (a: number, b: number) => (axis === 'x' ? gray[b * width + a] : gray[a * width + b]);
  const ridge = (d: number) => Math.max(0, polarity === 'light' ? d : -d);
  for (let a = 3; a < across - 3; a++) {
    let sum = 0;
    for (let b = 0; b < along; b++) {
      const here = 2 * at(a, b);
      const near = ridge(here - at(a - 2, b) - at(a + 2, b));
      const far = ridge(here - at(a - 3, b) - at(a + 3, b));
      sum += Math.max(near, far);
    }
    profile[a] = sum;
  }
  return profile;
}

// The profile blurred a little (a triangle seven pixels wide), so a line that falls between two pixels, or a dot
// whose edges give two peaks, becomes one bump centred where the line is, and a spacing that is not a whole number
// of pixels still matches itself at the whole-number lag next to it.
function blur(profile: Float32Array): Float32Array {
  const kernel = [1, 2, 3, 4, 3, 2, 1];
  const half = 3;
  return profile.map((_, i) => {
    let sum = 0;
    let weight = 0;
    kernel.forEach((k, j) => {
      const at = i + j - half;
      if (at >= 0 && at < profile.length) {
        sum += k * profile[at];
        weight += k;
      }
    });
    return sum / weight;
  });
}

// Mean zero and spread one, so profiles of different pictures and of the two axes can be compared and added.
function standardize(profile: Float32Array): Float32Array {
  let mean = 0;
  for (const v of profile) mean += v;
  mean /= profile.length;
  let variance = 0;
  for (const v of profile) variance += (v - mean) ** 2;
  const spread = Math.sqrt(variance / profile.length) || 1;
  return profile.map((v) => (v - mean) / spread);
}

// How well the profile matches itself shifted by `lag`, from -1 to 1.
function autocorrelation(profile: Float32Array, lag: number): number {
  let sum = 0;
  const n = profile.length - lag;
  for (let i = 0; i < n; i++) sum += profile[i] * profile[i + lag];
  return sum / n;
}

// The profile at a fractional position, by interpolating between pixels (0 off the ends).
function sample(profile: Float32Array, x: number): number {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= profile.length) return 0;
  const t = x - i;
  return profile[i] * (1 - t) + profile[i + 1] * t;
}

// A comb of lines `period` apart starting at `offset`: the average of the profile at each tooth. The average
// (not the sum) so a small period, which has more teeth, is not favoured.
function comb(profile: Float32Array, period: number, offset: number): number {
  let sum = 0;
  let teeth = 0;
  for (let x = offset; x < profile.length - 2; x += period) {
    sum += sample(profile, x);
    teeth++;
  }
  return teeth ? sum / teeth : 0;
}

// The best offset (0 up to the period) for a comb of this period, and its score.
function bestOffset(profile: Float32Array, period: number): { offset: number; score: number } {
  let best = { offset: 0, score: -Infinity };
  for (let offset = 0; offset < period; offset += 0.25) {
    const score = comb(profile, period, offset);
    if (score > best.score) best = { offset, score };
  }
  return best;
}

// The spacing, roughly: the smallest lag at which the profile matches itself nearly as well as at the best one (a
// spacing of two squares matches as well as one, so the smallest is the grid). Not the best refined comb over all
// the candidates: a larger spacing has fewer teeth and so scores higher on noise. Null if it does not repeat.
function roughPeriod(profile: Float32Array, maxPeriod: number): number | null {
  const matches: number[] = [];
  for (let lag = 0; lag <= maxPeriod + 1; lag++) {
    matches.push(lag < MIN_PERIOD - 1 ? 0 : autocorrelation(profile, lag));
  }
  const strongest = Math.max(...matches);
  if (strongest <= 0) return null;
  for (let lag = MIN_PERIOD; lag <= maxPeriod; lag++) {
    if (
      matches[lag] >= matches[lag - 1] &&
      matches[lag] >= matches[lag + 1] &&
      matches[lag] >= 0.4 * strongest
    ) {
      return lag;
    }
  }
  return null;
}

// The exact spacing and offset near a rough spacing: slides combs of spacings close to it over the profile(s).
// With two profiles (one square grid) the spacing is shared and the offsets are found for each.
function refine(profiles: Float32Array[], rough: number) {
  let best = { period: rough, offsets: [] as number[], score: -Infinity };
  for (let period = rough * 0.96; period <= rough * 1.04; period += rough * 0.002) {
    const found = profiles.map((p) => bestOffset(p, period));
    const score = found.reduce((sum, f) => sum + f.score, 0) / found.length;
    if (score > best.score) best = { period, offsets: found.map((f) => f.offset), score };
  }
  return best;
}

// The grid in a pair of profiles (along x and along y), or null. `score` is the combs' average height, which
// confidence is made from but is not capped at 1, so two readings of the same picture can be told apart.
function analyse(
  px: Float32Array,
  py: Float32Array,
  maxPeriod: number,
): { fit: GridFit; score: number } | null {
  const roughX = roughPeriod(px, maxPeriod);
  const roughY = roughPeriod(py, maxPeriod);
  if (roughX === null || roughY === null) return null; // a grid repeats both ways

  // Each way on its own first, to see whether the squares are square.
  const x = refine([px], roughX);
  const y = refine([py], roughY);
  let fit: GridFit;
  let score: number;
  if (Math.abs(x.period - y.period) / Math.max(x.period, y.period) < SAME_PERIOD) {
    // One square grid: a single spacing that suits both profiles best.
    const both = refine([px, py], (x.period + y.period) / 2);
    fit = {
      periodX: both.period,
      periodY: both.period,
      offsetX: both.offsets[0],
      offsetY: both.offsets[1],
      confidence: 0,
    };
    score = both.score;
  } else {
    fit = {
      periodX: x.period,
      periodY: y.period,
      offsetX: x.offsets[0],
      offsetY: y.offsets[0],
      confidence: 0,
    };
    score = (x.score + y.score) / 2;
  }
  // How sure: the combs' average height on the standardized profiles. A real grid puts its teeth on peaks well
  // above the average; a picture with no grid puts them on nothing in particular.
  fit.confidence = Math.max(0, Math.min(1, score / 4));
  return { fit, score };
}

// The grid of a picture, or null if it does not seem to have one. Tries light lines and dark lines, and takes
// whichever repeats more clearly. `minConfidence` is for tuning and tests.
export function detectGrid(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  minConfidence = MIN_CONFIDENCE,
): GridFit | null {
  const maxPeriod = Math.floor(Math.min(width, height) * MAX_PERIOD_FRACTION);
  if (maxPeriod <= MIN_PERIOD) return null;
  let best: { fit: GridFit; score: number } | null = null;
  for (const polarity of ['light', 'dark'] as const) {
    const px = standardize(blur(lineProfile(gray, width, height, 'x', polarity)));
    const py = standardize(blur(lineProfile(gray, width, height, 'y', polarity)));
    const found = analyse(px, py, maxPeriod);
    if (found && (!best || found.score > best.score)) best = found;
  }
  return best && best.fit.confidence >= minConfidence ? best.fit : null;
}

// ── Fitting the picture to our grid ────────────────────────────
// `box` is where the picture is now (its top left and size in world units) and `pixels` its size in its own
// pixels. Returns the box that makes the picture's squares exactly one of ours (`cell` world units) with its
// lines on ours: as many squares across and down as the picture has, and moved by less than a square. If the
// picture's squares are wider than tall (or the other way) it is stretched to make them square, which changes
// its proportions: the squares matter more than the picture's shape.
export type Box = { x: number; y: number; w: number; h: number };

export function fitToGrid(
  fit: GridFit,
  box: Box,
  pixels: { width: number; height: number },
  cell: number,
): Box {
  const scaleX = cell / fit.periodX; // world units per picture pixel after fitting
  const scaleY = cell / fit.periodY;
  // Where the picture's first lines fall now, and the nearest of our lines to them.
  const lineX = box.x + fit.offsetX * scaleX;
  const lineY = box.y + fit.offsetY * scaleY;
  return {
    x: box.x + (Math.round(lineX / cell) * cell - lineX),
    y: box.y + (Math.round(lineY / cell) * cell - lineY),
    w: pixels.width * scaleX,
    h: pixels.height * scaleY,
  };
}
