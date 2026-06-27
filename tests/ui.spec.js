import { test, expect } from '@playwright/test';
import { resetBoard } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('the version label shows the app version below the coordinates', async ({ page }) => {
  const versionText = await page.locator('#version-label').textContent();
  expect(versionText).toMatch(/^v\d+\.\d+\.\d+$/);

  const coordsBox = await page.locator('#hud-coords').boundingBox();
  const versionBox = await page.locator('#version-label').boundingBox();
  expect(versionBox.y).toBeGreaterThan(coordsBox.y);
});

test('the custom color "+" opens a popover instead of joining the swatch row', async ({ page }) => {
  await page.click('#tool-rect');
  const countBefore = await page.locator('#stroke-swatches .swatch').count();

  await page.click('#stroke-custom-add');
  await expect(page.locator('#stroke-color-popover')).toBeVisible();

  // The popover anchors near the button, not inside the swatch row.
  const countAfter = await page.locator('#stroke-swatches .swatch').count();
  expect(countAfter).toBe(countBefore);
});

test('the custom-color "+" icon is an SVG, not a text glyph (centering fix)', async ({ page }) => {
  await page.click('#tool-rect');
  const isSvgIcon = await page.evaluate(() => {
    const btn = document.getElementById('stroke-custom-add');
    return btn.querySelector('svg use') !== null && btn.textContent.trim() === '';
  });
  expect(isSvgIcon).toBe(true);
});

test('the label tool style panel preview updates with font size and color', async ({ page }) => {
  await page.click('#tool-text');
  const preview = page.locator('#label-preview-text');

  await page.evaluate(() => {
    const slider = document.getElementById('stroke-width');
    slider.value = 28;
    slider.dispatchEvent(new Event('input'));
  });
  await expect(preview).toHaveCSS('font-size', '28px');

  await page.click('#stroke-swatches [data-color="#a04040"]');
  await expect(preview).toHaveCSS('color', 'rgb(160, 64, 64)');
});

test('hovering the brand mark triggers the spin transform', async ({ page }) => {
  const before = await page.evaluate(() => getComputedStyle(document.getElementById('brand-icon')).transform);
  expect(before).toBe('none');

  const box = await page.locator('#brand-icon').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const mid = await page.evaluate(() => getComputedStyle(document.getElementById('brand-icon')).transform);
  expect(mid).not.toBe('none');
});

test('icon-sprite buttons re-color via currentColor when a tool becomes active', async ({ page }) => {
  await page.click('#tool-rect');
  await page.mouse.move(5, 5); // away from the button so :hover doesn't interfere
  await page.waitForTimeout(200); // let the 0.12s color transition finish
  const color = await page.evaluate(() => getComputedStyle(document.getElementById('tool-rect')).color);
  expect(color).toBe('rgb(201, 168, 76)'); // --accent gold
});
