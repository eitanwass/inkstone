import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const TEMPLATE = pathToFileURL(resolve('design/share-preview/template.html')).href;

test('the page has the tags chat apps read for a link preview', async ({ page }) => {
  await page.goto('/draw/');
  const meta = (selector) => page.locator(selector).getAttribute('content');

  expect(await meta('meta[name="description"]')).toMatch(/battle-map editor/);
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[property="og:site_name"]')).toBe('Inkstone');
  expect(await meta('meta[property="og:title"]')).toMatch(/Inkstone/);
  expect(await meta('meta[property="og:description"]')).toBeTruthy();
  expect(await meta('meta[property="og:image"]')).toMatch(/\/og-image\.png$/);
  expect(await meta('meta[property="og:image:width"]')).toBe('1200');
  expect(await meta('meta[property="og:image:height"]')).toBe('630');
  expect(await meta('meta[property="og:image:alt"]')).toBeTruthy();
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await page.content()).not.toContain('%SITE_URL%'); // the placeholder is always filled in
});

test('the preview image is served and is 1200x630', async ({ request }) => {
  const response = await request.get('/og-image.png');
  expect(response.status()).toBe(200);
  const png = Buffer.from(await response.body());
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(png.length).toBeLessThan(600 * 1024); // chat apps skip very large images
});

// A production build must turn the image address into an absolute URL, or most
// chat apps won't show it.
test('a production build writes absolute preview URLs', () => {
  const out = mkdtempSync(join(tmpdir(), 'inkstone-build-'));
  try {
    const build = (env) => {
      execFileSync(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'],
        {
          env: { ...process.env, SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '', ...env },
          stdio: 'ignore',
        },
      );
      return readFileSync(join(out, 'index.html'), 'utf8');
    };

    const explicit = build({ SITE_URL: 'https://inkstone.example/' });
    expect(explicit).toContain('property="og:image" content="https://inkstone.example/og-image.png"');
    expect(explicit).toContain('property="og:url" content="https://inkstone.example/"');
    expect(explicit).toContain('name="twitter:image" content="https://inkstone.example/og-image.png"');

    const vercel = build({ VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app' });
    expect(vercel).toContain('property="og:image" content="https://inkstone-app.vercel.app/og-image.png"');

    for (const html of [explicit, vercel]) expect(html).not.toContain('%SITE_URL%');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// The template is meant to be reused for per-map previews, so it has to be safe
// and well-behaved with arbitrary names that players type.
test.describe('the preview template, given a map name', () => {
  async function open(page, name) {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(name === undefined ? TEMPLATE : `${TEMPLATE}?name=${encodeURIComponent(name)}`);
    await page.waitForFunction(() => window.__ready === true);
  }

  test('shows the site card with no name, and the name as the hero with one', async ({ page }) => {
    await open(page);
    await expect(page.locator('#card')).toHaveClass('site');
    await expect(page.locator('.tagline')).toBeVisible();
    await expect(page.locator('#name')).toBeHidden();

    await open(page, 'The Sunken Crypt');
    await expect(page.locator('#card')).toHaveClass('named');
    await expect(page.locator('#name')).toHaveText('The Sunken Crypt');
    await expect(page.locator('.tagline')).toBeHidden();
  });

  test('treats the name as text, never as HTML', async ({ page }) => {
    const nasty = '<img src=x onerror="document.title=\'pwned\'"><b>bold</b>';
    await open(page, nasty);
    await expect(page.locator('#name')).toHaveText(nasty);
    expect(await page.locator('#name img, #name b').count()).toBe(0);
    expect(await page.title()).not.toBe('pwned');
  });

  test('shrinks long names to fit, truncates very long ones, and never overflows', async ({ page }) => {
    await open(page, 'The Sunken Crypt of Vael');
    const sizeOf = () =>
      page.locator('#name').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    const shortSize = await sizeOf();

    const long = 'The Forgotten Halls of the Thrice-Cursed Archmage of Vael Karthos';
    await open(page, long);
    expect(await sizeOf()).toBeLessThan(shortSize);

    const absurd = 'W'.repeat(200);
    await open(page, absurd);
    const text = await page.locator('#name').textContent();
    expect(text.length).toBeLessThanOrEqual(60);
    expect(text.endsWith('…')).toBe(true);
    expect(await sizeOf()).toBeGreaterThanOrEqual(44);
    const fits = await page
      .locator('#name')
      .evaluate((el) => el.scrollHeight <= el.parentElement.clientHeight + 1);
    expect(fits).toBe(true);
  });
});
