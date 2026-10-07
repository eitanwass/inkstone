import { expect, test } from '@playwright/test';
import { COMMUNITY_URL } from '../../src/community.ts';
import { resetBoard } from './helpers.js';

// "Join the community": the Discord invite, in the site's menu and footer and in the editor's Settings. Its address
// is one constant (src/community.ts), so these tests compare with that rather than repeating it.

const opensSafelyInANewTab = async (link) => {
  await expect(link).toHaveAttribute('href', COMMUNITY_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
};

test('the address is a permanent Discord invite', () => {
  expect(COMMUNITY_URL).toMatch(/^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
});

for (const path of ['/', '/docs/', '/contact/']) {
  test(`the ${path} page has a Community link in the menu and a button in the footer`, async ({ page }) => {
    await page.goto(path);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await opensSafelyInANewTab(nav.getByRole('link', { name: 'Community' }));
    const button = page.locator('.site-footer').getByRole('link', { name: 'Join the community' });
    await opensSafelyInANewTab(button);
    await expect(button).toBeVisible();
    // beside the coffee button, not instead of it
    await expect(page.locator('.site-footer').getByRole('link', { name: 'Buy me a coffee' })).toBeVisible();
  });
}

test('the footer buttons sit side by side on a wide screen and still fit on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const [coffee, community] = await Promise.all([
    page.locator('.coffee').boundingBox(),
    page.locator('.community').boundingBox(),
  ]);
  expect(Math.abs(coffee.y - community.y)).toBeLessThan(4); // one row
  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload();
  const phone = await page.locator('.community').boundingBox();
  expect(phone.x).toBeGreaterThanOrEqual(0);
  expect(phone.x + phone.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("the editor's Settings has the link, above the coffee one, quiet and at the foot of the tabs", async ({
  page,
}) => {
  await resetBoard(page);
  await page.click('#btn-settings');
  const modal = page.locator('#settings-modal');
  const community = modal.getByRole('link', { name: 'Join the community' });
  await expect(community).toBeVisible();
  await opensSafelyInANewTab(community);

  const coffee = modal.getByRole('link', { name: 'Buy me a coffee' });
  const [c, k, tabs] = await Promise.all([
    community.boundingBox(),
    coffee.boundingBox(),
    page.locator('#settings-tabs').boundingBox(),
  ]);
  expect(c.y).toBeLessThan(k.y); // community, then coffee
  expect(c.y).toBeGreaterThan(tabs.y + tabs.height); // below the tabs, and not one of them
  await expect(page.locator('#settings-tabs [role="tab"]')).toHaveCount(3);
});
