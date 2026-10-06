import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the home page offers to start drawing, and the button opens the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Draw the map');
  await expect(page.locator('#start')).toHaveAttribute('href', '/draw/');
  await page.click('#start');
  await expect(page).toHaveURL(/\/draw\/$/);
  await expect(page.locator('#tool-rect')).toBeVisible();
});

test('the map on top is shown', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('#hero-map');
  await expect(map).toBeVisible();
  expect(await map.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
});

test('the menu links to the docs and lists what is still coming', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Public creations', 'Contact']) await expect(nav.getByText(name)).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText(['Inkstone', 'Features', 'Docs', 'Start drawing']);
});

test('the page says it is free and offers a way to chip in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Free, and staying that way/ })).toBeVisible();
  const coffee = page.getByRole('link', { name: 'Buy me a coffee' });
  await expect(coffee).toHaveAttribute('target', '_blank');
  await expect(coffee).toHaveAttribute('rel', /noopener/);
});

test('an old invite link opens the editor with its session', async ({ page }) => {
  await page.goto('/?session=abc123');
  await expect(page).toHaveURL(/\/draw\/\?session=abc123$/);
});

test('on a phone the links fold into a menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(page.getByRole('link', { name: 'Features' })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Features' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // no sideways scroll
});

test('the home page has no accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // so nothing is caught mid-fade
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
