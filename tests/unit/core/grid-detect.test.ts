import { describe, expect, it } from 'vitest';
import { detectGrid, fitToGrid } from '../../../src/core/grid-detect';

// ── Synthetic scans ────────────────────────────────────────────
// A small deterministic random source, so a failure can be reproduced.
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scan = {
  width?: number;
  height?: number;
  period?: number; // pixels per square
  periodY?: number; // pixels per square down, if the squares are not square
  offset?: [number, number]; // where the first lines are
  lines?: boolean; // grid lines, else dots at the crossings
  contrast?: number; // how much darker the grid is than the paper
  lineWidth?: number;
  noise?: number; // random brightness, one standard deviation
  walls?: number; // dark rectangles at random places and sizes, nothing to do with the grid
  grid?: boolean; // false: a map with no grid at all
  seed?: number;
};

function scan({
  width = 1200,
  height = 900,
  period = 37.5,
  periodY = period,
  offset = [12.3, 7.8],
  lines = true,
  contrast = 70,
  lineWidth = 1.4,
  noise = 8,
  walls = 0,
  grid = true,
  seed = 1,
}: Scan = {}) {
  const rand = random(seed);
  const gray = new Float32Array(width * height).fill(225);
  const dist = (v: number, o: number, p: number) => {
    const d = (((v - o) % p) + p) % p;
    return Math.min(d, p - d); // to the nearest line
  };
  if (grid) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = dist(x, offset[0], period);
        const dy = dist(y, offset[1], periodY);
        const inGrid = lines ? Math.min(dx, dy) < lineWidth / 2 : Math.hypot(dx, dy) < lineWidth * 1.3;
        if (inGrid) gray[y * width + x] -= contrast;
      }
    }
  }
  for (let i = 0; i < walls; i++) {
    const w = 20 + rand() * 300;
    const h = 6 + rand() * 40;
    const x0 = Math.floor(rand() * (width - w));
    const y0 = Math.floor(rand() * (height - h));
    const horizontal = rand() < 0.5;
    const [bw, bh] = horizontal ? [w, h] : [h, w];
    for (let y = y0; y < Math.min(height, y0 + bh); y++) {
      for (let x = x0; x < Math.min(width, x0 + bw); x++) gray[y * width + x] = 60 + rand() * 30;
    }
  }
  for (let i = 0; i < gray.length; i++) gray[i] += (rand() + rand() + rand() - 1.5) * 2 * noise;
  return { gray, width, height };
}

// The distance between two offsets that wrap at `period`.
const wrapDiff = (a: number, b: number, period: number) => {
  const d = Math.abs(a - b) % period;
  return Math.min(d, period - d);
};

function expectFit(s: ReturnType<typeof scan>, period: number, offset: [number, number], tolerance = 0.004) {
  const fit = detectGrid(s.gray, s.width, s.height);
  expect(fit).not.toBeNull();
  if (!fit) return;
  expect(Math.abs(fit.periodX - period) / period).toBeLessThan(tolerance);
  expect(Math.abs(fit.periodY - period) / period).toBeLessThan(tolerance);
  expect(wrapDiff(fit.offsetX, offset[0], period)).toBeLessThan(1.5);
  expect(wrapDiff(fit.offsetY, offset[1], period)).toBeLessThan(1.5);
}

describe('detectGrid', () => {
  it('finds the spacing and the lines of a clean grid, including a spacing that is not a whole number', () => {
    expectFit(scan({ noise: 0 }), 37.5, [12.3, 7.8]);
  });

  it('finds it through paper noise', () => {
    expectFit(scan({ noise: 14 }), 37.5, [12.3, 7.8]);
  });

  it('finds a faint grid', () => {
    expectFit(scan({ contrast: 22, noise: 8 }), 37.5, [12.3, 7.8]);
  });

  it('finds a grid of dots, not lines', () => {
    expectFit(scan({ lines: false, lineWidth: 2.2, contrast: 90 }), 37.5, [12.3, 7.8]);
  });

  it('finds it among walls and rooms that do not follow the grid', () => {
    expectFit(scan({ walls: 40, noise: 10 }), 37.5, [12.3, 7.8]);
  });

  it('finds small and large squares', () => {
    expectFit(scan({ period: 14.2, offset: [3.1, 9.9] }), 14.2, [3.1, 9.9]);
    expectFit(scan({ period: 140.7, offset: [60, 25.5], width: 1800, height: 1400 }), 140.7, [60, 25.5]);
  });

  it('takes one square, not two, when every other line is a little stronger', () => {
    const s = scan({ noise: 4 });
    // make every second vertical and horizontal line darker
    const period = 37.5;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const nx = Math.round((x - 12.3) / period);
        const ny = Math.round((y - 7.8) / period);
        const near = Math.abs(x - (12.3 + nx * period)) < 0.7 || Math.abs(y - (7.8 + ny * period)) < 0.7;
        if (near && (nx % 2 === 0 || ny % 2 === 0)) s.gray[y * s.width + x] -= 25;
      }
    }
    expectFit(s, 37.5, [12.3, 7.8]);
  });

  it('measures the two ways separately when the squares are wider than tall, as on many generated maps', () => {
    const fit = detectGrid(
      ...(([s]) => [s.gray, s.width, s.height] as const)([
        scan({ period: 45.9, periodY: 48.8, offset: [10.2, 20.4] }),
      ]),
    );
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(Math.abs(fit.periodX - 45.9) / 45.9).toBeLessThan(0.006);
    expect(Math.abs(fit.periodY - 48.8) / 48.8).toBeLessThan(0.006);
    expect(wrapDiff(fit.offsetX, 10.2, 45.9)).toBeLessThan(1.5);
    expect(wrapDiff(fit.offsetY, 20.4, 48.8)).toBeLessThan(1.5);
  });

  it('takes squares that differ by under a percent as true squares, with one spacing', () => {
    const s = scan({ period: 40, periodY: 40.2 });
    const fit = detectGrid(s.gray, s.width, s.height);
    expect(fit?.periodX).toBe(fit?.periodY);
  });

  it('says there is none on a map with no grid, however busy', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = scan({ grid: false, walls: 60, noise: 14, seed });
      expect(detectGrid(s.gray, s.width, s.height)).toBeNull();
    }
    const blank = scan({ grid: false, noise: 0 });
    expect(detectGrid(blank.gray, blank.width, blank.height)).toBeNull();
  });

  it('is quick enough to run on a picture as large as the app keeps (2048 pixels)', () => {
    const s = scan({ width: 2048, height: 1536, walls: 30 });
    const started = performance.now();
    const fit = detectGrid(s.gray, s.width, s.height);
    expect(fit).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('fitToGrid', () => {
  it('stretches a picture whose squares are not square until they are', () => {
    const wide = { periodX: 45.9, periodY: 48.8, offsetX: 10, offsetY: 20, confidence: 1 };
    const box = fitToGrid(wide, { x: 0, y: 0, w: 600, h: 300 }, { width: 1376, height: 768 }, 40);
    expect(box.w).toBeCloseTo((1376 / 45.9) * 40, 6); // 30 squares across
    expect(box.h).toBeCloseTo((768 / 48.8) * 40, 6); // 15.7 down
    expect(box.w / box.h).not.toBeCloseTo(1376 / 768, 2); // the proportions changed
  });

  const fit = { periodX: 37.5, periodY: 37.5, offsetX: 12.3, offsetY: 7.8, confidence: 1 };

  it('sizes the picture so one of its squares is one of ours, and keeps its proportions', () => {
    const box = fitToGrid(fit, { x: 100, y: 60, w: 600, h: 450 }, { width: 1200, height: 900 }, 40);
    expect(box.w).toBeCloseTo((1200 / 37.5) * 40, 6); // 32 squares across
    expect(box.h / box.w).toBeCloseTo(900 / 1200, 6);
  });

  it('moves it so its lines are on ours, by less than a square', () => {
    const start = { x: 100.5, y: 63.2, w: 600, h: 450 };
    const box = fitToGrid(fit, start, { width: 1200, height: 900 }, 40);
    const scale = 40 / 37.5;
    expect((box.x + 12.3 * scale) % 40).toBeCloseTo(0, 6);
    expect((box.y + 7.8 * scale) % 40).toBeCloseTo(0, 6);
    expect(Math.abs(box.x - start.x)).toBeLessThanOrEqual(20);
    expect(Math.abs(box.y - start.y)).toBeLessThanOrEqual(20);
  });
});
