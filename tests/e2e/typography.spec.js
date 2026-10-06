import { expect, test } from '@playwright/test';

test('fonts are bundled with the app, not fetched from a third party', async ({ page, baseURL }) => {
  const fontRequests = [];
  const external = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\.(woff2?|ttf|otf)$/.test(url.pathname)) fontRequests.push(url.pathname);
    if (url.origin !== new URL(baseURL).origin && !url.protocol.startsWith('data'))
      external.push(request.url());
  });
  await page.goto('/draw/');
  await page.waitForSelector('#tool-rect');
  await page.waitForFunction(() => document.fonts.check('14px "Inter Variable"'));
  await page.waitForFunction(() => document.fonts.check('500 25px "EB Garamond"'));

  expect(fontRequests.length).toBeGreaterThan(0);
  expect(external, "no request may leave the app's own origin").toEqual([]);
});

test('the UI is set in Inter and the wordmark in upright EB Garamond', async ({ page }) => {
  await page.goto('/draw/');
  await page.waitForSelector('#tool-rect');

  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(body).toMatch(/^"?Inter Variable"?/);

  const wordmark = await page.locator('#brand-mark span').evaluate((el) => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, style: s.fontStyle, weight: s.fontWeight, size: s.fontSize };
  });
  expect(wordmark.family).toMatch(/^"?EB Garamond"?/);
  expect(wordmark.style).toBe('normal'); // not italic
  expect(wordmark.weight).toBe('500');
  expect(wordmark.size).toBe('25px');
});

test('the HUD numbers stay in the system monospace', async ({ page }) => {
  await page.goto('/draw/');
  const family = await page.locator('#cursor-pos').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toBe('monospace');
});

test('text drawn on the map uses the same font as the UI', async ({ page }) => {
  await page.goto('/draw/');
  await page.waitForSelector('#tool-rect');
  await page.waitForFunction(() => document.fonts.check('14px "Inter Variable"'));
  // The field a label is typed into is real text in the canvas's font stack.
  await page.click('#tool-text');
  await page.mouse.click(500, 400);
  const family = await page.locator('#label-editor').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"?Inter Variable"?/);
});
