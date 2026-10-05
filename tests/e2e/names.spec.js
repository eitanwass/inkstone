import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

// A player's name in shared maps: asked once, on joining, if they have none; changed in Settings, Profile.

// A stand-in relay that says hello back like the real one and records what the page sends.
async function relay(page) {
  const sent = [];
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      sent.push(message);
      if (message.type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
      }
    });
  });
  return sent;
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-player')));
const dialog = (page) => page.locator('#name-dialog');

test.describe('with no name yet', () => {
  test.beforeEach(async ({ page }) => {
    await relay(page);
    await resetBoard(page, { named: false });
  });

  test('sharing asks first, with a fantasy name already filled in, and no way to skip', async ({ page }) => {
    await page.click('#btn-share');
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('#name-title')).toHaveText("Who's at the table?");
    await expect(page.locator('#name-input')).toHaveValue(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    await expect(dialog(page).getByRole('button', { name: /skip/i })).toHaveCount(0);
    await expect(page.locator('#share-popover')).toBeHidden(); // nothing is shared until a name is chosen

    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5); // the backdrop
    await expect(dialog(page)).toBeVisible();
  });

  test('the shuffle button on the right suggests another name', async ({ page }) => {
    await page.click('#btn-share');
    const input = page.locator('#name-input');
    const first = await input.inputValue();
    await page.click('#name-shuffle');
    await expect(input).not.toHaveValue(first);
    await expect(input).toHaveValue(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  test('continuing keeps the name, connects with it, and opens the share popover', async ({ page }) => {
    const sent = await relay(page);
    await resetBoard(page, { named: false });
    await page.click('#btn-share');
    await page.fill('#name-input', '  Gilded   Fox ');
    await page.click('#name-join');

    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('#share-popover')).toBeVisible();
    expect((await stored(page)).name).toBe('Gilded Fox');
    await expect.poll(() => sent.find((m) => m.type === 'hello')?.player.name).toBe('Gilded Fox');
  });

  test('Enter continues, and an empty name cannot', async ({ page }) => {
    await page.click('#btn-share');
    await page.fill('#name-input', '   ');
    await expect(page.locator('#name-join')).toBeDisabled();
    await page.fill('#name-input', 'Ashen Warden');
    await page.press('#name-input', 'Enter');
    await expect(dialog(page)).toBeHidden();
    expect((await stored(page)).name).toBe('Ashen Warden');
  });

  test('an invite link asks before it connects', async ({ page }) => {
    const sent = await relay(page);
    await page.goto('/?session=abc123');
    await expect(dialog(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect(sent).toHaveLength(0);
    await page.click('#name-join');
    await expect.poll(() => sent.some((m) => m.type === 'hello')).toBe(true);
  });
});

test('with a name already saved nothing is asked', async ({ page }) => {
  const sent = await relay(page);
  await resetBoard(page);
  await page.click('#btn-share');
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#share-popover')).toBeVisible();
  await expect.poll(() => sent.find((m) => m.type === 'hello')?.player.name).toBe('Tester One');
});

test.describe('Settings, Profile', () => {
  const openProfile = async (page) => {
    await page.click('#btn-settings');
    await page.click('#settings-tab-profile');
  };

  test('is the last tab, and shows the current name', async ({ page }) => {
    await resetBoard(page);
    await page.click('#btn-settings');
    await expect(page.locator('#settings-tabs [role="tab"]').last()).toHaveText('Profile');
    await page.click('#settings-tab-profile');
    await expect(page.locator('#profile-name')).toHaveValue('Tester One');
  });

  test('a typed name is kept on Enter, tidied, and sent to the room', async ({ page }) => {
    const sent = await relay(page);
    await resetBoard(page);
    await page.click('#btn-share');
    await expect.poll(() => sent.some((m) => m.type === 'hello')).toBe(true);
    await page.keyboard.press('Escape');
    await openProfile(page);
    await page.fill('#profile-name', '  Quiet   Heron ');
    await page.press('#profile-name', 'Enter');
    await expect(page.locator('#profile-name')).toHaveValue('Quiet Heron');
    expect((await stored(page)).name).toBe('Quiet Heron');
    await expect.poll(() => sent.find((m) => m.type === 'rename')?.name).toBe('Quiet Heron');
  });

  test('says "Saved" when a name is kept, and not before or when nothing changed', async ({ page }) => {
    await resetBoard(page);
    await openProfile(page);
    const saved = page.locator('#settings-saved');
    await expect(saved).toHaveCSS('opacity', '0');
    await page.fill('#profile-name', 'Quiet Heron');
    await expect(saved).toHaveCSS('opacity', '0'); // typing alone keeps nothing
    await page.press('#profile-name', 'Enter');
    await expect(saved).toHaveText('Saved');
    await expect(saved).toHaveCSS('opacity', '1');
    await expect(saved).toHaveCSS('opacity', '0', { timeout: 5000 }); // and goes again
    await page.click('#profile-shuffle');
    await expect(saved).toHaveText('Saved');
  });

  test('an empty name puts the old one back', async ({ page }) => {
    await resetBoard(page);
    await openProfile(page);
    await page.fill('#profile-name', '   ');
    await page.press('#profile-name', 'Enter');
    await expect(page.locator('#profile-name')).toHaveValue('Tester One');
    expect((await stored(page)).name).toBe('Tester One');
  });

  test('shuffle picks a fantasy name and keeps it', async ({ page }) => {
    await resetBoard(page);
    await openProfile(page);
    await page.click('#profile-shuffle');
    const name = await page.locator('#profile-name').inputValue();
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect((await stored(page)).name).toBe(name);
  });
});

test("hovering someone's icon shows their name", async ({ page }) => {
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      if (JSON.parse(raw).type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
        ws.send(
          JSON.stringify({ type: 'presence', count: 1, players: [{ id: 'zed', name: 'Wandering Bard' }] }),
        );
      }
    });
  });
  await resetBoard(page);
  await page.click('#btn-share');
  const player = page.locator('#players .player').first();
  const tip = player.locator('.player-name');
  await expect(tip).toHaveText('Wandering Bard');
  await expect(tip).toHaveCSS('opacity', '0');
  await player.hover();
  await expect(tip).toHaveCSS('opacity', '1');
});
