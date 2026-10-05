import { expect, test } from '@playwright/test';
import { boardElements, placeLabel, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// Bold, italic and a plate behind the text: the same three buttons in a label's card and in a token's (for
// its name). Each is one undo step; a flag that is off is not saved at all.

let toScreen;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
});

const toggle = (page, card, name) => page.locator(`${card} button[aria-label="${name}"]`);
const first = async (page) => (await boardElements(page))[0];

test.describe('a label', () => {
  const CARD = '#label-text-style';
  let at;

  test.beforeEach(async ({ page }) => {
    await placeLabel(page, toScreen, 320, 320, 'Throne Room');
    at = toScreen(332, 328);
    await page.click('#tool-select');
    await page.mouse.click(at.x, at.y);
  });

  test('has the three buttons in its card, all off to start', async ({ page }) => {
    for (const name of ['Bold', 'Italic', 'Background plate']) {
      await expect(toggle(page, CARD, name)).toBeVisible();
      await expect(toggle(page, CARD, name)).toHaveAttribute('aria-pressed', 'false');
    }
    expect(await first(page)).not.toHaveProperty('bold');
  });

  test('bold, italic and plate are set on the label, and marked on', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Italic').click();
    await toggle(page, CARD, 'Background plate').click();
    expect(await first(page)).toMatchObject({ text: 'Throne Room', bold: true, italic: true, plate: true });
    for (const name of ['Bold', 'Italic', 'Background plate']) {
      await expect(toggle(page, CARD, name)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('switching one off takes it off the label, rather than saving it as false', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Bold').click();
    const label = await first(page);
    expect(label).not.toHaveProperty('bold');
    await expect(toggle(page, CARD, 'Bold')).toHaveAttribute('aria-pressed', 'false');
  });

  test('each is one undo step', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Italic').click();
    await page.click('#btn-undo');
    expect(await first(page)).toMatchObject({ bold: true });
    expect(await first(page)).not.toHaveProperty('italic');
    await page.click('#btn-undo');
    expect(await first(page)).not.toHaveProperty('bold');
    await page.click('#btn-redo');
    expect(await first(page)).toMatchObject({ bold: true });
  });

  test('a plate makes the label bigger to click, because it reaches out around the text', async ({
    page,
  }) => {
    const just = toScreen(318, 316); // a little up and left of the label's corner, in where a plate would be
    await page.mouse.click(900, 700); // nothing selected
    await page.mouse.click(just.x, just.y);
    await expect(page.locator('#label-card')).toBeHidden(); // not on the label

    await page.mouse.click(at.x, at.y);
    await toggle(page, CARD, 'Background plate').click();
    await page.mouse.click(900, 700);
    await page.mouse.click(just.x, just.y);
    await expect(page.locator('#label-card')).toBeVisible(); // now it is
  });

  test('is shown in the field while the text is edited in place', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Italic').click();
    await page.mouse.dblclick(at.x, at.y);
    await expect(page.locator('#label-editor')).toHaveCSS('font-weight', '700');
    await expect(page.locator('#label-editor')).toHaveCSS('font-style', 'italic');
  });

  test('is what the next new label starts as', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Background plate').click();
    await page.click('#tool-text');
    await page.mouse.click(700, 500);
    await page.keyboard.type('Next');
    await page.keyboard.press('Enter');
    expect((await boardElements(page))[1]).toMatchObject({ text: 'Next', bold: true, plate: true });
    expect((await boardElements(page))[1]).not.toHaveProperty('italic');
  });

  test('a new label with no text yet can be styled first, and keeps it', async ({ page }) => {
    await page.click('#tool-text');
    await page.mouse.click(700, 500);
    await toggle(page, CARD, 'Italic').click();
    await page.locator('#label-editor').click();
    await page.keyboard.type('Slanted');
    await page.keyboard.press('Enter');
    expect((await boardElements(page))[1]).toMatchObject({ text: 'Slanted', italic: true });
  });

  test('is sent to a shared session as one change to the label', async ({ page }) => {
    const sent = [];
    await page.routeWebSocket(/\/parties\//, (ws) => {
      ws.onMessage((raw) => {
        const message = JSON.parse(raw);
        if (message.type === 'hello') {
          ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
        } else {
          sent.push(message);
        }
      });
    });
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.click('#btn-share');
    await expect(page.locator('#collab-status')).toHaveText('Live');
    await page.click('#tool-select');
    await page.mouse.click(at.x, at.y);
    await toggle(page, CARD, 'Bold').click();
    await expect.poll(() => sent.at(-1)?.type).toBe('changes');
    expect(sent.at(-1).changes).toEqual([
      { t: 'set', el: expect.objectContaining({ type: 'label', bold: true }) },
    ]);
  });
});

test.describe('a token’s name', () => {
  const CARD = '#token-text-style';
  let tokenAt;

  test.beforeEach(async ({ page }) => {
    await placeToken(page, toScreen, 160, 160, 'Goblin');
    tokenAt = toScreen(180, 180);
    await page.click('#tool-select');
    await page.mouse.click(tokenAt.x, tokenAt.y);
  });

  test('has the same three buttons in its card', async ({ page }) => {
    for (const name of ['Bold', 'Italic', 'Background plate']) {
      await expect(toggle(page, CARD, name)).toBeVisible();
      await expect(toggle(page, CARD, name)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('set the style on the token, each as one undo step', async ({ page }) => {
    await toggle(page, CARD, 'Bold').click();
    await toggle(page, CARD, 'Background plate').click();
    expect(await first(page)).toMatchObject({ name: 'Goblin', bold: true, plate: true });
    await expect(toggle(page, CARD, 'Bold')).toHaveAttribute('aria-pressed', 'true');

    await page.click('#btn-undo');
    expect(await first(page)).not.toHaveProperty('plate');
    await page.click('#btn-undo');
    expect(await first(page)).not.toHaveProperty('bold');
  });

  test('a token that has no name can be given a style too, for when it is named', async ({ page }) => {
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter'); // the name is gone
    await toggle(page, CARD, 'Italic').click();
    expect(await first(page)).toMatchObject({ italic: true });
    expect(await first(page)).not.toHaveProperty('name');
  });

  test('the style survives a reload', async ({ page }) => {
    await toggle(page, CARD, 'Italic').click();
    await page.reload();
    await page.waitForSelector('#tool-rect');
    expect(await first(page)).toMatchObject({ italic: true });
  });
});
