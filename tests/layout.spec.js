import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

// The bottom panels are centered with left: 50%, which on its own limits them to
// half the screen. They should be as wide as their contents, up to the screen.
for (const width of [1440, 1280, 1100, 900, 700]) {
  test(`the style panel and tool dock are never clipped at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await resetBoard(page);
    await page.click('#tool-rect'); // shows the style panel

    for (const id of ['#style-panel', '#tool-dock']) {
      const panel = page.locator(id);
      const clipped = await panel.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `${id} should not need to scroll at ${width}px`).toBe(false);
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  });
}

test('on a phone-width screen the style panel stays on screen and scrolls instead', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 700 });
  await resetBoard(page);
  await page.click('#tool-rect');

  const panel = page.locator('#style-panel');
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(380);
  expect(await panel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});
