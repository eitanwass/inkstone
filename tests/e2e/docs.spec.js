import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the docs are reached from the home page menu, which marks them as the current page', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' }).click();
  await expect(page).toHaveURL(/\/docs\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to use Inkstone');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('every entry in the list on the side leads to a section', async ({ page }) => {
  await page.goto('/docs/');
  const hrefs = await page.locator('#toc a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(8);
  for (const href of hrefs) await expect(page.locator(href)).toHaveCount(1);
});

test('the list marks the section being read', async ({ page }) => {
  await page.goto('/docs/#sharing');
  await expect(page.locator('#toc a[href="#sharing"]')).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#toc [aria-current]')).toHaveCount(1);
});

// The editor's own list (the ? button) and the docs say the same keys.
test('the shortcuts in the docs are the ones the editor lists', async ({ page }) => {
  const keys = (locator) =>
    locator.evaluateAll((els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()).sort());
  await page.goto('/draw/');
  const editor = await keys(page.locator('#shortcuts-popover dt'));
  await page.goto('/docs/');
  const docs = await keys(page.locator('#shortcuts .keys tbody th'));
  expect(docs).toEqual(editor);
});

test('the docs say the site is free and link to the editor', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.getByRole('link', { name: 'Buy me a coffee' })).toBeVisible();
  await page.locator('.doc-cta a').click();
  await expect(page).toHaveURL(/\/draw\/$/);
});

test('on a phone the list sits above the text and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/docs/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const toc = await page.locator('.toc').boundingBox();
  const doc = await page.locator('.doc').boundingBox();
  expect(toc.y).toBeLessThan(doc.y);
});

test('the docs have no accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/docs/');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});
