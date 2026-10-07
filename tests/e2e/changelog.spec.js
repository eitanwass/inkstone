import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openActionBar, resetBoard } from './helpers.js';

const releases = [...readFileSync('CHANGELOG.md', 'utf8').matchAll(/^## (\S+)/gm)].map((m) => m[1]);

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

// Opens the modal and waits for its scale-in to finish, so sizes measured next
// are the real ones and not a frame of the animation.
async function openChangelog(page) {
  await page.click('#btn-changelog');
  await page
    .locator('#changelog-modal')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

test("the What's new modal lists every release, newest first", async ({ page }) => {
  await expect(page.locator('#changelog-modal')).toBeHidden();
  await page.click('#btn-changelog');
  await expect(page.locator('#changelog-modal')).toBeVisible();

  // Each heading is the version text plus a <time> child, so read its own text node.
  const versions = await page
    .locator('.changelog-entry h3')
    .evaluateAll((els) => els.map((el) => el.firstChild.textContent));
  expect(versions).toEqual(releases.map((v) => `v${v}`));
  await expect(page.locator('.changelog-entry').first().locator('li').first()).not.toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(page.locator('#changelog-modal')).toBeHidden();
});

test('the changelog button shows a dot until the current version has been opened', async ({ page }) => {
  await expect(page.locator('#btn-changelog')).toHaveClass(/has-update/);

  await page.click('#btn-changelog');
  await expect(page.locator('#btn-changelog')).not.toHaveClass(/has-update/);

  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(page.locator('#btn-changelog')).not.toHaveClass(/has-update/);

  // A newer version than the one last seen brings the dot back.
  await page.evaluate(() => localStorage.setItem('inkstone-changelog-seen', '0.0.1'));
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(page.locator('#btn-changelog')).toHaveClass(/has-update/);
});

test('the modal is centered, about three quarters of the viewport, over a blurred page', async ({ page }) => {
  const viewport = page.viewportSize();
  await openChangelog(page);

  const box = await page.locator('#changelog-modal').boundingBox();
  expect(box.width / viewport.width).toBeCloseTo(0.75, 1);
  expect(box.height / viewport.height).toBeCloseTo(0.75, 1);
  expect(box.x + box.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(viewport.height / 2, 0);

  await expect(page.locator('#changelog-overlay')).toHaveCSS('backdrop-filter', /blur\(/);
});

test('on a phone the modal takes nearly the whole screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openActionBar(page);
  await openChangelog(page);

  const box = await page.locator('#changelog-modal').boundingBox();
  expect(box.width).toBeGreaterThan(390 * 0.9);
  expect(box.height).toBeGreaterThan(844 * 0.8);
});

test('it closes from the Close button or a click on the page behind, but not from a click inside', async ({
  page,
}) => {
  const modal = page.locator('#changelog-modal');

  await page.click('#btn-changelog');
  await modal.locator('h2').click();
  await expect(modal).toBeVisible();
  await page.click('#changelog-close');
  await expect(modal).toBeHidden();

  await page.click('#btn-changelog');
  await expect(modal).toBeVisible();
  await page.mouse.click(8, 8); // the blurred area, outside the modal
  await expect(modal).toBeHidden();
});

test('a long list of releases scrolls inside the modal instead of growing it', async ({ page }) => {
  await openChangelog(page);
  const before = await page.locator('#changelog-modal').boundingBox();
  await page.evaluate(() => {
    const list = document.getElementById('changelog-list');
    for (let i = 0; i < 30; i++) list.append(list.firstElementChild.cloneNode(true));
  });
  const after = await page.locator('#changelog-modal').boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);

  const body = page.locator('#changelog-body');
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});
