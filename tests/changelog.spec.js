import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const releases = [...readFileSync('CHANGELOG.md', 'utf8').matchAll(/^## (\S+)/gm)].map((m) => m[1]);

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test("the What's new panel lists every release, newest first", async ({ page }) => {
  await expect(page.locator('#changelog-popover')).toBeHidden();
  await page.click('#btn-changelog');
  await expect(page.locator('#changelog-popover')).toBeVisible();

  // Each heading is the version text plus a <time> child, so read its own text node.
  const versions = await page
    .locator('.changelog-entry h3')
    .evaluateAll((els) => els.map((el) => el.firstChild.textContent));
  expect(versions).toEqual(releases.map((v) => `v${v}`));
  expect(versions[0]).toBe(`v${version}`);
  await expect(page.locator('.changelog-entry').first().locator('li').first()).not.toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(page.locator('#changelog-popover')).toBeHidden();
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

// parseChangelog is pure, so call it directly through the dev server.
test('parseChangelog reads versions, dates and bullets and ignores the rest', async ({ page }) => {
  const entries = await page.evaluate(async () => {
    const { parseChangelog } = await import('/src/changelog-parse.ts');
    return parseChangelog(
      '# Changelog\nintro text\n\n## 1.2.0 - 2026-01-02\n- Added a thing\n* Fixed a\n  wrapped thing\n\n## 1.1.0\n- Older\nstray line\n',
    );
  });
  expect(entries).toEqual([
    { version: '1.2.0', date: '2026-01-02', changes: ['Added a thing', 'Fixed a wrapped thing'] },
    { version: '1.1.0', date: null, changes: ['Older'] },
  ]);
});
