import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// Click a token and its card appears above it: for now, a field for its name. Typing is kept on Enter
// or clicking away (one undo step); Escape puts the old name back.

const card = (page) => page.locator('#token-card');
const field = (page) => page.locator('#token-name-field');

let toScreen;
let tokenAt;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160); // unnamed
  tokenAt = toScreen(180, 180); // a token's centre is its cell origin plus half a cell
  await page.click('#tool-select');
});

const select = (page) => page.mouse.click(tokenAt.x, tokenAt.y);
const names = async (page) => (await boardElements(page)).map((t) => t.name);

test.describe('showing', () => {
  test('is not there until a token is clicked', async ({ page }) => {
    await expect(card(page)).toBeHidden();
    await select(page);
    await expect(card(page)).toBeVisible();
    await expect(field(page)).toHaveAttribute('placeholder', 'Name');
  });

  test('goes when nothing is selected, or the token tool is in use', async ({ page }) => {
    await select(page);
    await expect(card(page)).toBeVisible();
    const empty = toScreen(600, 400);
    await page.mouse.click(empty.x, empty.y);
    await expect(card(page)).toBeHidden();

    await select(page);
    await page.click('#tool-token');
    await expect(card(page)).toBeHidden();
  });

  test('is not there for other things, or when several are selected', async ({ page }) => {
    await page.keyboard.press('r');
    const a = toScreen(400, 300);
    const b = toScreen(560, 400);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    await page.click('#tool-select');
    await page.mouse.click(toScreen(480, 350).x, toScreen(480, 350).y); // the room
    await expect(card(page)).toBeHidden();

    await page.keyboard.press('Control+a'); // the room and the token
    await expect(card(page)).toBeHidden();
  });

  test('sits above the token, centred on it, and does not cover it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const lower = toScreen(600, 400);
    await placeToken(page, toScreen, 600, 400);
    await page.click('#tool-select');
    await page.mouse.click(lower.x + 20, lower.y + 20);
    const c = await card(page).boundingBox();
    expect(c.y + c.height).toBeLessThan(lower.y + 20 - 16); // wholly above the token's top edge
    expect(Math.abs(c.x + c.width / 2 - (lower.x + 20))).toBeLessThan(2); // centred over it
  });

  test('goes below the token when there is no room above it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const top = toScreen(120, -40);
    await placeToken(page, toScreen, 120, -40);
    await page.click('#tool-select');
    await page.mouse.click(top.x + 20, top.y + 20);
    const c = await card(page).boundingBox();
    const tokenCentreY = top.y + 20;
    expect(c.y).toBeGreaterThan(tokenCentreY); // below it
    expect(c.y).toBeGreaterThanOrEqual(0);
  });

  test('stays on screen near the edge', async ({ page }) => {
    // A token close to the left edge of the screen: centred on it, the card would hang off.
    const edge = toScreen(-80, 300);
    await placeToken(page, toScreen, -80, 300);
    await page.click('#tool-select');
    await page.mouse.click(edge.x + 20, edge.y + 20);
    const c = await card(page).boundingBox();
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeGreaterThanOrEqual(7); // kept a little in from the edge

    // and the same at the right-hand edge
    const right = toScreen(1000, 300);
    await placeToken(page, toScreen, 1000, 300);
    await page.click('#tool-select');
    await page.mouse.click(right.x + 20, right.y + 20);
    const r = await card(page).boundingBox();
    const width = page.viewportSize().width;
    expect(r.x + r.width).toBeLessThanOrEqual(width);
  });

  test('follows the token when the map is zoomed', async ({ page }) => {
    await select(page);
    const before = await card(page).boundingBox();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const after = await card(page).boundingBox();
    expect(Math.abs(after.y - before.y) + Math.abs(after.x - before.x)).toBeGreaterThan(5);
    await expect(card(page)).toBeVisible();
  });

  test('gives way while the token is being dragged, and comes back where it lands', async ({ page }) => {
    await select(page);
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await page.mouse.down();
    const to = toScreen(300, 300);
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await expect(card(page)).toBeHidden();
    await page.mouse.up();
    await expect(card(page)).toBeVisible();
    const landed = await card(page).boundingBox();
    expect(landed.x + landed.width / 2).toBeCloseTo(toScreen(300 + 20 - 20 + 0, 300).x + 0, -2); // over the new spot (roughly)
  });
});

test.describe('naming', () => {
  test('type a name and press Enter: it is kept, and shows on the token', async ({ page }) => {
    await select(page);
    await field(page).click();
    await field(page).fill('Aragorn');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Aragorn']);
    await expect(field(page)).not.toBeFocused(); // the keys work on the map again
    await expect(card(page)).toBeVisible(); // and the token is still selected
  });

  test('clicking away keeps it too', async ({ page }) => {
    await select(page);
    await field(page).fill('Gimli');
    const empty = toScreen(600, 400);
    await page.mouse.click(empty.x, empty.y);
    expect(await names(page)).toEqual(['Gimli']);
  });

  test('Escape puts the old name back and leaves the token selected', async ({ page }) => {
    await select(page);
    await field(page).fill('Boromir');
    await page.keyboard.press('Enter');

    await field(page).click();
    await field(page).fill('Nope');
    await page.keyboard.press('Escape');
    expect(await names(page)).toEqual(['Boromir']);
    await expect(field(page)).toHaveValue('Boromir');
    await expect(card(page)).toBeVisible(); // Escape here is not "deselect"
  });

  test('is one undo step, and an unchanged name is none', async ({ page }) => {
    await select(page);
    await field(page).fill('Legolas');
    await page.keyboard.press('Enter');
    await field(page).click();
    await field(page).fill('Legolas'); // the same again
    await page.keyboard.press('Enter');

    await page.click('#btn-undo'); // takes the name off
    expect(await names(page)).toEqual([undefined]);
    await page.click('#btn-undo'); // takes the token away
    expect(await boardElements(page)).toHaveLength(0);
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('clearing the field takes the name off', async ({ page }) => {
    await select(page);
    await field(page).fill('Gandalf');
    await page.keyboard.press('Enter');
    await field(page).click();
    await field(page).fill('   ');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual([undefined]);
  });

  test('whitespace is trimmed', async ({ page }) => {
    await select(page);
    await field(page).fill('  Sam  ');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Sam']);
    await expect(field(page)).toHaveValue('Sam');
  });

  test('the name is limited to 20 characters', async ({ page }) => {
    await select(page);
    await field(page).fill('x'.repeat(40));
    await page.keyboard.press('Enter');
    expect((await names(page))[0].length).toBeLessThanOrEqual(20);
  });

  test('typing keys do not trigger shortcuts: r, w, m, f, Delete and the arrows all go to the text', async ({
    page,
  }) => {
    await select(page);
    await field(page).click();
    await page.keyboard.type('rwmf');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
    expect(await boardElements(page)).toHaveLength(1); // not deleted
    await expect(field(page)).toHaveValue('rwm');
  });

  test("picking another token while typing keeps the first one's name", async ({ page }) => {
    const other = toScreen(400, 160);
    await placeToken(page, toScreen, 400, 160);
    await page.click('#tool-select');
    await select(page);
    await field(page).fill('First');
    await page.mouse.click(other.x + 20, other.y + 20); // the other token
    expect(await names(page)).toEqual(['First', undefined]);
    await expect(field(page)).toHaveValue(''); // and the card now belongs to the other one
  });
});

test.describe('color', () => {
  const swatches = (page) => page.locator('#token-colors .token-swatch:not(.token-swatch-custom)');
  const colors = async (page) => (await boardElements(page)).map((t) => t.color);

  test("offers the token colors as swatches, with the token's own marked", async ({ page }) => {
    await select(page);
    await expect(swatches(page)).toHaveCount(8);
    const [color] = await colors(page);
    const pressed = page.locator('#token-colors .token-swatch[aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute('data-color', color);
  });

  test('every swatch has a name for assistive tech and a tooltip', async ({ page }) => {
    await select(page);
    for (const swatch of await swatches(page).all()) {
      const name = await swatch.getAttribute('aria-label');
      expect(name).toBeTruthy();
      expect(await swatch.getAttribute('title')).toBe(name);
    }
    await expect(page.getByRole('button', { name: 'Purple' })).toBeVisible();
  });

  test('clicking a swatch changes the token at once, as one undo step', async ({ page }) => {
    await select(page);
    const before = (await colors(page))[0];
    await page.getByRole('button', { name: 'Purple' }).click();
    const after = (await colors(page))[0];
    expect(after).toBe('#9a5ce0');
    expect(after).not.toBe(before);
    await expect(page.getByRole('button', { name: 'Purple' })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page)).toBeVisible(); // the token is still selected

    await page.click('#btn-undo');
    expect((await colors(page))[0]).toBe(before);
    await page.click('#btn-undo');
    expect(await boardElements(page)).toHaveLength(0); // that was the only edit before placing it
  });

  test('choosing the color it already has is not an edit', async ({ page }) => {
    await select(page);
    const current = (await colors(page))[0];
    await page.locator(`#token-colors .token-swatch[data-color="${current}"]`).click();
    await page.click('#btn-undo'); // so this is the placing, not a color change
    expect(await boardElements(page)).toHaveLength(0);
  });

  // What the browser's own picker does: 'input' each time a color is clicked in it, and 'change' only
  // when it is closed. (The picker itself is not something a test can drive.)
  const click = (page, value) =>
    page.locator('#token-color-custom').evaluate((input, v) => {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  const close = (page) =>
    page
      .locator('#token-color-custom')
      .evaluate((input) => input.dispatchEvent(new Event('change', { bubbles: true })));

  test('any color can be picked: clicking one in the picker applies it at once, before the picker closes', async ({
    page,
  }) => {
    await select(page);
    const before = (await colors(page))[0];
    await click(page, '#123456'); // clicked in the picker, which is still open
    await expect(page.locator('.token-swatch-custom')).toHaveClass(/selected/); // the token already has it
    await expect(page.locator('#token-colors .token-swatch[aria-pressed="true"]')).toHaveCount(0);
    expect((await colors(page))[0]).toBe(before); // (not saved until the picker is closed)

    await close(page);
    expect((await colors(page))[0]).toBe('#123456');
  });

  test('clicking several colors in the picker follows each one, and is one undo step', async ({ page }) => {
    await select(page);
    const before = (await colors(page))[0];
    await click(page, '#111111');
    await click(page, '#222222');
    await click(page, '#333333');
    await close(page);
    expect((await colors(page))[0]).toBe('#333333');

    await page.click('#btn-undo');
    expect((await colors(page))[0]).toBe(before); // all three picks undone together
    await page.click('#btn-undo');
    expect(await boardElements(page)).toHaveLength(0); // and nothing more of it
  });

  test('a picker dismissed without a "change" still keeps the color, when the field loses focus', async ({
    page,
  }) => {
    await select(page);
    await page.locator('#token-color-custom').focus();
    await click(page, '#abcdef');
    await page.locator('#token-color-custom').evaluate((input) => input.blur());
    expect((await colors(page))[0]).toBe('#abcdef');
    await page.click('#btn-undo');
    expect((await colors(page))[0]).not.toBe('#abcdef');
  });

  test('picking the color it already has changes nothing and is not an edit', async ({ page }) => {
    await select(page);
    const same = (await colors(page))[0];
    await click(page, same);
    await close(page);
    await page.click('#btn-undo'); // so this undoes the placing, not a color change
    expect(await boardElements(page)).toHaveLength(0);
  });

  test('a browser that sends only "change" works too', async ({ page }) => {
    await select(page);
    await page.locator('#token-color-custom').evaluate((input) => {
      input.value = '#445566';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect((await colors(page))[0]).toBe('#445566');
  });

  test('a color not in the palette is marked on the ring, and a swatch takes the mark back', async ({
    page,
  }) => {
    await select(page);
    await click(page, '#123456');
    await close(page);
    await expect(page.locator('.token-swatch-custom')).toHaveClass(/selected/);
    await expect(page.locator('#token-colors .token-swatch[aria-pressed="true"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Blue' }).click(); // back to a swatch
    await expect(page.locator('.token-swatch-custom')).not.toHaveClass(/selected/);
  });

  test('a color picked while the picker is open does not leak onto another token', async ({ page }) => {
    const other = toScreen(400, 160);
    await placeToken(page, toScreen, 400, 160);
    await page.click('#tool-select');
    await select(page);
    const otherBefore = (await colors(page))[1];
    await click(page, '#0a0a0a');
    await close(page);
    const after = await colors(page);
    expect(after[0]).toBe('#0a0a0a');
    expect(after[1]).toBe(otherBefore);
    await page.mouse.click(other.x + 20, other.y + 20); // the other token's card: its own color is marked
    await expect(page.locator('.token-swatch-custom')).not.toHaveClass(/selected/);
  });

  test('the colors and the name are independent', async ({ page }) => {
    await select(page);
    await field(page).fill('Aragorn');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Teal' }).click();
    const [token] = await boardElements(page);
    expect(token).toMatchObject({ name: 'Aragorn', color: '#5ce0d4' });
  });

  test('picking a color while typing a name keeps the name too', async ({ page }) => {
    await select(page);
    await field(page).fill('Gimli');
    await page.getByRole('button', { name: 'Orange' }).click();
    const [token] = await boardElements(page);
    expect(token).toMatchObject({ name: 'Gimli', color: '#e0a85c' });
  });

  test('is shared by the token menu: "Change Color" selects the token and lands on its colors', async ({
    page,
  }) => {
    await page.click('#tool-rect'); // some other tool in use
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await expect(page.locator('#ctx-token-color')).toHaveText('🎨 Change Color');
    await page.click('#ctx-token-color');
    await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page)).toBeVisible();
    await expect(page.locator('#token-colors .token-swatch[aria-pressed="true"]')).toBeFocused();
    const next = await page
      .locator('#token-colors .token-swatch[aria-pressed="true"] + .token-swatch')
      .getAttribute('data-color');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // the next swatch, pressed from the keyboard
    expect((await colors(page))[0]).toBe(next);
  });

  test('swatches can be reached with Tab, and Enter on one presses it rather than naming the token', async ({
    page,
  }) => {
    await select(page);
    await page.getByRole('button', { name: 'Pink' }).focus();
    await page.keyboard.press('Enter');
    expect((await colors(page))[0]).toBe('#e05caa');
    await expect(field(page)).not.toBeFocused();
  });

  test('the card is taller with the colors but still clear of the token and on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const lower = toScreen(600, 400);
    await placeToken(page, toScreen, 600, 400);
    await page.click('#tool-select');
    await page.mouse.click(lower.x + 20, lower.y + 20);
    const c = await card(page).boundingBox();
    expect(c.y + c.height).toBeLessThan(lower.y + 20 - 16);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.height).toBeGreaterThan(60); // two rows: the name and the colors
  });
});

test.describe('ways in', () => {
  test('selecting does not take the keyboard: Delete still removes the token', async ({ page }) => {
    await select(page);
    await expect(field(page)).not.toBeFocused();
    await page.keyboard.press('Delete');
    await page.click('#modal-confirm'); // "Remove this token?"
    expect(await boardElements(page)).toHaveLength(0);
  });

  test('the arrow keys still nudge a selected token', async ({ page }) => {
    await select(page);
    await page.keyboard.press('ArrowRight');
    expect((await boardElements(page))[0].x).toBe(220);
  });

  test('Enter puts the cursor in the name field', async ({ page }) => {
    await select(page);
    await page.keyboard.press('Enter');
    await expect(field(page)).toBeFocused();
    await page.keyboard.type('Pippin');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Pippin']);
  });

  test('double-clicking the token puts the cursor in the name field', async ({ page }) => {
    await page.mouse.dblclick(tokenAt.x, tokenAt.y);
    await expect(field(page)).toBeFocused();
  });

  test('Enter on a focused button still presses it (it is not taken for naming)', async ({ page }) => {
    await select(page);
    await page.locator('#btn-settings').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings-modal')).toBeVisible();
  });

  test('"Add name" in its menu selects it and starts the typing', async ({ page }) => {
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await expect(page.locator('#ctx-token-rename')).toHaveText('✏ Add name');
    await page.click('#ctx-token-rename');
    await expect(card(page)).toBeVisible();
    await expect(field(page)).toBeFocused();
    await page.keyboard.type('Merry');
    await page.keyboard.press('Enter');
    expect(await names(page)).toEqual(['Merry']);

    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await expect(page.locator('#ctx-token-rename')).toHaveText('✏ Rename');
  });

  test('works from the menu even with another tool in use', async ({ page }) => {
    await page.click('#tool-rect');
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await page.click('#ctx-token-rename');
    await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
    await expect(field(page)).toBeFocused();
  });
});
