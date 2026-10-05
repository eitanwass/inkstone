import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

// A production build with no VITE_RELAY_HOST. The dev server always has a
// relay to fall back to, so this serves collab.ts with its dev flag turned off
// (and fails loudly if Vite ever changes how it injects that flag).
async function loadAsProductionWithoutRelay(page, { url = '/' } = {}) {
  await page.route(/[/]src[/]collab[/]collab[.]ts/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body.replace(/"DEV":\s*true/, '"DEV":false');
    if (patched === body) throw new Error('collab.ts has no DEV flag to turn off');
    await route.fulfill({ response, body: patched });
  });

  const sockets = [];
  // Relay connections only: Vite's own hot-reload socket must not be counted.
  await page.routeWebSocket(/\/parties\//, (ws) => sockets.push(ws));

  await page.goto(url);
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(300);
  return sockets;
}

test('Share explains itself instead of reaching for localhost', async ({ page }) => {
  const sockets = await loadAsProductionWithoutRelay(page);

  await page.click('#btn-share');
  await expect(page.locator('#toast')).toContainText("Sharing isn't set up on this site");
  await expect(page.locator('#share-popover')).toBeHidden();
  await expect(page.locator('#collab-status')).toBeHidden();
  expect(page.url()).not.toContain('session=');
  expect(sockets).toHaveLength(0);
});

test('Join explains itself too', async ({ page }) => {
  const sockets = await loadAsProductionWithoutRelay(page);

  await page.click('#btn-join');
  await expect(page.locator('#toast')).toContainText("Sharing isn't set up on this site");
  await expect(page.locator('#join-popover')).toBeHidden();
  expect(sockets).toHaveLength(0);
});

test('opening an invite link tells the visitor why it cannot connect', async ({ page }) => {
  const sockets = await loadAsProductionWithoutRelay(page, { url: '/?session=abc123' });

  await expect(page.locator('#toast')).toContainText('This link is for a shared map');
  await expect(page.locator('#collab-status')).toBeHidden();
  expect(sockets).toHaveLength(0);
});

test('the dev server still connects (the localhost fallback is for development only)', async ({ page }) => {
  const sockets = [];
  await page.routeWebSocket(/\/parties\//, (ws) => sockets.push(ws));
  await resetBoard(page);

  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toBeVisible();
  await expect.poll(() => sockets.length).toBe(1); // the pill shows as soon as it starts connecting
  expect(sockets[0].url()).toContain('localhost:8787');
});

test('the first-visit hint does not invite people to share what is not set up', async ({ page }) => {
  await loadAsProductionWithoutRelay(page);
  await expect(page.locator('#first-visit-hint')).toBeVisible();
  await expect(page.locator('.hint-share')).toBeHidden();
  await expect(page.locator('.hint-help')).toBeVisible(); // the rest of the hint is unaffected
});
