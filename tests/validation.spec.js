import { expect, test } from '@playwright/test';
import { boardElements, resetBoard } from './helpers.js';

// Loads the app with raw text already sitting in localStorage, the way a
// corrupt or hand-edited save would be.
async function loadWithSavedBoard(page, raw) {
  await page.evaluate((value) => localStorage.setItem('inkstone-board', value), raw);
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('a saved board keeps its valid elements and drops malformed ones', async ({ page }) => {
  const saved = [
    { type: 'rect', x: 0, y: 0, w: 80, h: 80 },
    { type: 'rect', x: 'oops', y: 0, w: 80, h: 80 }, // wrong field type
    { type: 'wall', x1: 0, y1: 0, x2: 40 }, // missing y2
    { type: 'hologram', x: 0, y: 0 }, // unknown type
    { type: 'token', x: 40, y: 40, name: 'Bob' },
    null,
    'not an element',
  ];
  await loadWithSavedBoard(page, JSON.stringify(saved));

  const elements = await boardElements(page);
  expect(elements.map((e) => e.type)).toEqual(['rect', 'token']);
  await expect(page.locator('#toast')).toContainText('restored');
});

test('a saved board that is not a list is ignored, not crashed on', async ({ page }) => {
  for (const raw of ['{"type":"rect"}', 'not json at all', '42']) {
    await loadWithSavedBoard(page, raw);
    expect(await boardElements(page)).toEqual([]);
    await expect(page.locator('#toast')).toContainText('Welcome!');
  }
});

// parseElements is a pure function, so this calls it directly through the dev
// server's module graph instead of driving the UI (collab snapshots go
// through the same function but need a running relay to exercise).
test('parseElements rejects non-finite numbers and non-lists', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const { parseElements } = await import('/src/validate.ts');
    return {
      notList: parseElements({ type: 'rect' }),
      nullInput: parseElements(null),
      infinite: parseElements([{ type: 'rect', x: 0, y: 0, w: Number.POSITIVE_INFINITY, h: 1 }]),
      prototypeKey: parseElements([{ type: 'constructor', x: 0, y: 0 }]),
      ok: parseElements([{ type: 'label', x: 0, y: 0, text: 'hi', strokeColor: '#fff' }]),
    };
  });
  expect(results.notList).toBeNull();
  expect(results.nullInput).toBeNull();
  expect(results.infinite).toEqual([]);
  expect(results.prototypeKey).toEqual([]);
  expect(results.ok).toHaveLength(1);
});
