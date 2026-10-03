import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

// Reduced motion skips the popovers' fade-in, which would otherwise make axe
// sample half-transparent colors and report contrast failures that aren't real.
async function violations(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
}

test.describe('axe finds no violations', () => {
  test('on the main screen', async ({ page }) => {
    expect(await violations(page)).toEqual([]);
  });

  test('with the style panel and a custom-color popover open', async ({ page }) => {
    await page.click('#tool-rect');
    await page.click('#stroke-custom-add');
    await expect(page.locator('#stroke-color-popover')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("with the What's new modal open", async ({ page }) => {
    await page.click('#btn-changelog');
    await expect(page.locator('#changelog-modal')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('with the join popover open', async ({ page }) => {
    await page.click('#btn-join');
    await expect(page.locator('#join-popover')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('with the shortcut list open', async ({ page }) => {
    await page.click('#btn-shortcuts');
    await expect(page.locator('#shortcuts-popover')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('with a token selected and its card showing', async ({ page }) => {
    await page.click('#tool-token');
    const box = await page.locator('#interaction-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.1 + 200, box.y + box.height * 0.1 + 200);
    await page.click('#tool-select');
    await page.mouse.click(box.x + box.width * 0.1 + 220, box.y + box.height * 0.1 + 220);
    await expect(page.locator('#token-card')).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.fill('#token-name-field', 'Aragorn');
    expect(await violations(page)).toEqual([]); // with a name typed in, too
  });

  test('with the settings open', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(page.locator('#settings-modal')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('with the settings open and a size that cannot be used typed in', async ({ page }) => {
    await page.click('#btn-settings');
    await page.fill('#board-per-cell', '0');
    await expect(page.locator('#board-per-cell')).toHaveAttribute('aria-invalid', 'true');
    expect(await violations(page)).toEqual([]);
  });

  test('with an Undo toast showing', async ({ page }) => {
    await page.click('#btn-clear');
    await page.click('#modal-confirm');
    await expect(page.locator('#toast .toast-action')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('when the browser cannot save, and the indicator says so', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await resetBoard(page);
    await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'failed');
    expect(await violations(page)).toEqual([]);
  });

  test('with a map name set, and while it is being edited', async ({ page }) => {
    await page.click('#map-name');
    await page.keyboard.type('The Sunken Crypt of Vael');
    await expect(page.locator('#map-name')).toBeFocused();
    expect(await violations(page)).toEqual([]); // focused, with the editing background

    await page.keyboard.press('Enter');
    await expect(page.locator('#map-name')).not.toBeFocused();
    expect(await violations(page)).toEqual([]); // at rest, with a name
  });

  test('with a dialog open', async ({ page }) => {
    await page.click('#btn-clear');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test('every button has an accessible name', async ({ page }) => {
  await page.click('#tool-rect'); // reveals the style panel's buttons too
  const unnamed = await page
    .locator('button')
    .evaluateAll((buttons) =>
      buttons
        .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.title))
        .map((b) => b.id || b.className),
    );
  expect(unnamed).toEqual([]);
});

test('the active tool is exposed as pressed', async ({ page }) => {
  await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tool-wall')).toHaveAttribute('aria-pressed', 'false');

  await page.click('#tool-wall');
  await expect(page.locator('#tool-wall')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'false');
});

test('the selected swatch is exposed as pressed', async ({ page }) => {
  await page.click('#tool-rect');
  const parchment = page.locator('#stroke-swatches [data-color="#e8dcc8"]');
  const gold = page.locator('#stroke-swatches [data-color="#c9a84c"]');
  await expect(parchment).toHaveAttribute('aria-pressed', 'true');

  await gold.click();
  await expect(gold).toHaveAttribute('aria-pressed', 'true');
  await expect(parchment).toHaveAttribute('aria-pressed', 'false');
});

test('popover buttons report their expanded state', async ({ page }) => {
  const button = page.locator('#btn-join');
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');

  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test("the What's new modal takes focus, keeps Tab inside, and Escape returns focus to its button", async ({
  page,
}) => {
  const button = page.locator('#btn-changelog');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#changelog-modal')).toBeFocused();

  // Tab cycles through the modal's own controls and never reaches the page behind it.
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    expect(await page.evaluate(() => !!document.activeElement?.closest('#changelog-modal'))).toBe(true);
  }
  expect(seen).toContain('changelog-close');
  expect(seen).toContain('changelog-body');

  await page.keyboard.press('Escape');
  await expect(page.locator('#changelog-overlay')).toBeHidden();
  await expect(button).toBeFocused();
});

test('the confirm dialog focuses Cancel, keeps Tab inside, and restores focus on close', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.focus('#btn-clear');
  await page.keyboard.press('Enter');
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#modal-cancel')).toBeFocused();

  // Tab cycles Cancel -> Confirm -> back to Cancel; it never reaches the page behind.
  await page.keyboard.press('Tab');
  await expect(page.locator('#modal-confirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#modal-cancel')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#modal-confirm')).toBeFocused();

  await page.locator('#modal-cancel').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#btn-clear')).toBeFocused();
});

test('a text dialog traps focus and returns it to where it came from', async ({ page }) => {
  await page.click('#tool-text');
  const toScreen = await worldToScreenFn(page);
  const p = toScreen(160, 160);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#text-label-overlay')).toBeVisible();
  await expect(page.locator('#text-label-input')).toBeFocused();

  await page.keyboard.press('Shift+Tab'); // from the first field it wraps to the last button
  await expect(page.locator('#text-label-confirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#text-label-input')).toBeFocused();
});
