import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// Conditions on tokens: badges on the token, the picker in its card, the right-click submenu, the
// hover list, and making your own in Settings. A condition is an object (id, name, color, icon) and
// a token carries whole copies.

let toScreen;
let tokenAt;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160); // an unnamed token, centre (180, 180)
  tokenAt = toScreen(180, 180);
  await page.click('#tool-select');
});

const card = (page) => page.locator('#token-card');
const picker = (page) => page.locator('#token-cond-picker');
const pills = (page) => page.locator('#token-cond-pills .tc-pill');
const select = (page) => page.mouse.click(tokenAt.x, tokenAt.y);
const conditionsOf = async (page, index = 0) => (await boardElements(page))[index].conditions;
const ids = async (page, index = 0) => ((await conditionsOf(page, index)) ?? []).map((c) => c.id);

async function openPicker(page) {
  await select(page);
  await page.click('#token-cond-add');
  await expect(picker(page)).toBeVisible();
}
const choose = (page, name) => page.locator('#token-cond-grid .tc-cond', { hasText: name }).click();

// What colour the canvas has at a screen point (the canvas is full-bleed, so these are the same).
const pixel = (page, x, y) =>
  page.evaluate(
    ([px, py]) =>
      Array.from(document.getElementById('main-canvas').getContext('2d').getImageData(px, py, 1, 1).data),
    [Math.round(x), Math.round(y)],
  );
const near = (rgba, [r, g, b], tolerance = 24) =>
  Math.abs(rgba[0] - r) <= tolerance &&
  Math.abs(rgba[1] - g) <= tolerance &&
  Math.abs(rgba[2] - b) <= tolerance;

test.describe('the card', () => {
  test('says None for a token without conditions, and has an Add button', async ({ page }) => {
    await select(page);
    await expect(card(page)).toBeVisible();
    await expect(page.locator('#token-cond-pills')).toHaveText('None');
    await expect(page.locator('#token-cond-add')).toHaveText('+ Add');
    await expect(picker(page)).toBeHidden();
  });

  test('Add opens a picker of the sixteen defaults, each with its badge', async ({ page }) => {
    await openPicker(page);
    await expect(page.locator('#token-cond-grid .tc-cond')).toHaveCount(16);
    for (const name of ['Blinded', 'Prone', 'Poisoned', 'Unconscious', 'Dead']) {
      await expect(page.locator('#token-cond-grid .tc-cond', { hasText: name })).toBeVisible();
    }
    await expect(page.locator('#token-cond-grid .tc-cond svg').first()).toBeVisible();
    await expect(page.locator('#token-cond-add')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#token-cond-add')).toHaveText('Done');
  });

  test('choosing one adds it to the token as a whole condition, and shows it as a pill', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page).first()).toContainText('Prone');
    const [prone] = await conditionsOf(page);
    expect(prone).toEqual({ id: 'prone', name: 'Prone', color: '#6d4fc7', icon: 'arrow-down' });
    await expect(page.locator('#token-cond-grid .tc-cond', { hasText: 'Prone' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('choosing it again takes it off, and a token with none carries no list at all', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await choose(page, 'Prone');
    expect(await conditionsOf(page)).toBeUndefined();
    expect('conditions' in (await boardElements(page))[0]).toBe(false);
    await expect(page.locator('#token-cond-pills')).toHaveText('None');
  });

  test("a pill's × takes that one off", async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await choose(page, 'Charmed');
    await page.getByRole('button', { name: 'Remove Prone' }).click();
    expect(await ids(page)).toEqual(['charmed']);
  });

  test('keeps the order they were added in', async ({ page }) => {
    await openPicker(page);
    for (const name of ['Stunned', 'Blinded', 'Poisoned']) await choose(page, name);
    expect(await ids(page)).toEqual(['stunned', 'blinded', 'poisoned']);
  });

  test('typing filters the picker, and Enter switches the first match', async ({ page }) => {
    await openPicker(page);
    await page.fill('#token-cond-filter', 'ar');
    await expect(page.locator('#token-cond-grid .tc-cond:visible')).toHaveCount(2); // Charmed, Paralyzed
    await page.keyboard.press('Enter');
    expect(await ids(page)).toEqual(['charmed']); // the first of them
    await page.fill('#token-cond-filter', 'PRON'); // capitals don't matter, and one match is enough
    await expect(page.locator('#token-cond-grid .tc-cond:visible')).toHaveCount(1);
    await page.keyboard.press('Enter');
    expect(await ids(page)).toEqual(['charmed', 'prone']);
    await page.fill('#token-cond-filter', 'zzzz'); // nothing matches: Enter does nothing
    await page.keyboard.press('Enter');
    expect(await ids(page)).toEqual(['charmed', 'prone']);
  });

  test('every change is one undo step', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await choose(page, 'Charmed');
    await page.click('#btn-undo');
    expect(await ids(page)).toEqual(['prone']);
    await page.click('#btn-undo');
    expect(await conditionsOf(page)).toBeUndefined();
    await page.click('#btn-redo');
    expect(await ids(page)).toEqual(['prone']);
  });

  test('Escape closes the picker (not the card), and Done does too', async ({ page }) => {
    await openPicker(page);
    await page.keyboard.press('Escape');
    await expect(picker(page)).toBeHidden();
    await expect(card(page)).toBeVisible();
    await expect(page.locator('#token-cond-add')).toBeFocused();
    await expect(page.locator('#token-cond-add')).toHaveAttribute('aria-expanded', 'false');

    await page.click('#token-cond-add');
    await page.click('#token-cond-add'); // "Done"
    await expect(picker(page)).toBeHidden();
  });

  test('another token starts with the picker shut', async ({ page }) => {
    const other = toScreen(400, 160);
    await placeToken(page, toScreen, 400, 160);
    await page.click('#tool-select');
    await openPicker(page);
    await page.mouse.click(other.x + 20, other.y + 20);
    await expect(picker(page)).toBeHidden();
  });

  test('the card grows with the picker but stays on screen', async ({ page }) => {
    await openPicker(page);
    const box = await card(page).boundingBox();
    const size = page.viewportSize();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  });

  test('a token can carry twelve, and no more', async ({ page }) => {
    await openPicker(page);
    const names = [
      'Blinded',
      'Charmed',
      'Deafened',
      'Exhaustion',
      'Frightened',
      'Grappled',
      'Incapacitated',
      'Invisible',
      'Paralyzed',
      'Petrified',
      'Poisoned',
      'Prone',
      'Restrained',
    ];
    for (const name of names) await choose(page, name);
    expect(await ids(page)).toHaveLength(12);
    await expect(page.locator('#toast')).toContainText('up to 12');
  });

  test('the conditions are saved, and come back after a reload', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Frightened');
    await page.reload();
    await page.waitForSelector('#tool-rect');
    expect(await ids(page)).toEqual(['frightened']);
  });

  test('a duplicate has its own copy of them', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); // deselect
    await select(page);
    await page.keyboard.press('Control+d');
    expect(await ids(page, 0)).toEqual(['prone']);
    expect(await ids(page, 1)).toEqual(['prone']);
    await page.click('#token-cond-add');
    await choose(page, 'Prone'); // off the copy only
    expect(await ids(page, 1)).toEqual([]);
    expect(await ids(page, 0)).toEqual(['prone']);
  });
});

test.describe('the badges on the canvas', () => {
  // A medium token's badge sits on the top of its rim; a point inside the badge but clear of the icon.
  const rimTop = () => ({ x: tokenAt.x, y: tokenAt.y - 16.8 });
  const insideBadge = () => ({ x: rimTop().x - 5.5, y: rimTop().y });

  test("a condition draws a badge in its color on the token's rim", async ({ page }) => {
    const before = await pixel(page, insideBadge().x, insideBadge().y);
    expect(near(before, [0x2f, 0x7d, 0x32])).toBe(false); // nothing green there yet

    await openPicker(page);
    await choose(page, 'Poisoned');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const after = await pixel(page, insideBadge().x, insideBadge().y);
    expect(near(after, [0x2f, 0x7d, 0x32])).toBe(true); // Poisoned's green
  });

  test('a token with no conditions draws none', async ({ page }) => {
    const [, g, b] = await pixel(page, insideBadge().x, insideBadge().y);
    expect([g, b]).not.toEqual([0x7d, 0x32]);
  });

  test('a dead token is greyed whatever its color, and crossed out', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Dead');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const body = await pixel(page, tokenAt.x + 12, tokenAt.y); // on the disc, clear of the cross
    expect(near(body, [0x8b, 0x85, 0x7a], 14)).toBe(true);
    const cross = await pixel(page, tokenAt.x, tokenAt.y); // where the two strokes meet
    expect(near(cross, [0x7f, 0x1d, 0x1d], 30)).toBe(true);
  });

  test('zoomed far out the badges fold into one gold dot', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Poisoned');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    for (let i = 0; i < 5; i++) await page.keyboard.press('-'); // well below 55%
    const zoomed = await page.locator('#zoom-label').innerText();
    expect(Number.parseInt(zoomed, 10)).toBeLessThan(55);

    // Where is the token now? Find the gold dot by scanning above it is fiddly: ask the page.
    const found = await page.evaluate(() => {
      const c = document.getElementById('main-canvas');
      const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        if (Math.abs(r - 0xc9) < 8 && Math.abs(g - 0xa8) < 8 && Math.abs(b - 0x4c) < 8) return true;
      }
      return false;
    });
    expect(found).toBe(true);
  });
});

test.describe('the right-click Conditions submenu', () => {
  const row = (page) => page.locator('#ctx-token-conditions');
  const menu = (page) => page.locator('#token-conditions-menu');
  const item = (page, name) => menu(page).locator('.ctx-cond', { hasText: name });

  async function openSubmenu(page) {
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await row(page).hover();
    await expect(menu(page)).toBeVisible();
  }

  test('the token menu has a Conditions row that opens a list of all of them', async ({ page }) => {
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await expect(row(page)).toContainText('Conditions');
    await expect(menu(page)).toBeHidden();
    await row(page).hover();
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).locator('.ctx-cond')).toHaveCount(16);
    await expect(row(page)).toHaveClass(/open/); // the row stays lit while its list is out
  });

  test('clicking one switches it on, with a tick, and the menu stays open', async ({ page }) => {
    await openSubmenu(page);
    await item(page, 'Prone').click();
    await expect(menu(page)).toBeVisible();
    await expect(item(page, 'Prone')).toHaveAttribute('aria-checked', 'true');
    expect(await ids(page)).toEqual(['prone']);

    await item(page, 'Stunned').click(); // another, in the same visit
    expect(await ids(page)).toEqual(['prone', 'stunned']);
    await item(page, 'Prone').click(); // and one off again
    await expect(item(page, 'Prone')).toHaveAttribute('aria-checked', 'false');
    expect(await ids(page)).toEqual(['stunned']);
  });

  test('shows what the token already has as ticked', async ({ page }) => {
    await select(page);
    await page.click('#token-cond-add');
    await choose(page, 'Charmed');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await openSubmenu(page);
    await expect(item(page, 'Charmed')).toHaveAttribute('aria-checked', 'true');
    await expect(item(page, 'Blinded')).toHaveAttribute('aria-checked', 'false');
  });

  test('each switch is one undo step', async ({ page }) => {
    await openSubmenu(page);
    await item(page, 'Prone').click();
    await item(page, 'Poisoned').click();
    await page.keyboard.press('Control+z');
    expect(await ids(page)).toEqual(['prone']);
  });

  test('a click anywhere else closes the submenu with the rest', async ({ page }) => {
    await openSubmenu(page);
    await page.mouse.click(1100, 120); // empty map, well clear of both menus
    await expect(menu(page)).toBeHidden();
    await expect(page.locator('#token-context-menu')).toBeHidden();
  });

  test('choosing another item of the token menu closes the submenu too', async ({ page }) => {
    await openSubmenu(page);
    await page.locator('#ctx-token-color').click();
    await expect(menu(page)).toBeHidden();
  });

  test('stays on screen: it opens on the left when there is no room on the right', async ({ page }) => {
    await placeToken(page, toScreen, 1100, 300); // snaps to the cell at (1080, 320), centre (1120, 340)
    const far = toScreen(1120, 340);
    await page.mouse.click(far.x, far.y, { button: 'right' });
    await row(page).hover();
    const box = await menu(page).boundingBox();
    const size = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  });

  test('works on the token that was right-clicked even with others selected', async ({ page }) => {
    const other = toScreen(400, 160);
    await placeToken(page, toScreen, 400, 160);
    await page.click('#tool-select');
    await page.keyboard.press('Control+a');
    await page.mouse.click(other.x + 20, other.y + 20, { button: 'right' });
    await row(page).hover();
    await item(page, 'Blinded').click();
    expect(await ids(page, 0)).toEqual([]);
    expect(await ids(page, 1)).toEqual(['blinded']);
  });
});

test.describe('the hover list', () => {
  const tip = (page) => page.locator('#token-tip');

  test('hovering a token with conditions lists them by name', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await choose(page, 'Poisoned');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.click(600, 500); // deselect
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Prone');
    await expect(tip(page)).toContainText('Poisoned');
  });

  test('goes when the pointer leaves the token', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.click(600, 500);
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await expect(tip(page)).toBeVisible();
    await page.mouse.move(600, 500);
    await expect(tip(page)).toBeHidden();
  });

  test('is not shown for a token with no conditions', async ({ page }) => {
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await page.waitForTimeout(150);
    await expect(tip(page)).toBeHidden();
  });

  test('is not shown for the token whose card is open: the card lists them', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await page.mouse.move(tokenAt.x + 1, tokenAt.y + 1);
    await page.waitForTimeout(150);
    await expect(tip(page)).toBeHidden();
  });

  test('never takes a click: the token under it can still be picked', async ({ page }) => {
    await openPicker(page);
    await choose(page, 'Prone');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.click(600, 500);
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await expect(tip(page)).toBeVisible();
    await page.mouse.click(tokenAt.x, tokenAt.y);
    await expect(card(page)).toBeVisible();
    await expect(tip(page)).toBeHidden();
  });
});

test.describe('your own conditions, in Settings', () => {
  const tab = (page) => page.locator('#settings-tab-conditions');
  const panel = (page) => page.locator('#settings-panel-conditions');

  async function openPanel(page) {
    await page.click('#btn-settings');
    await tab(page).click();
    await expect(panel(page)).toBeVisible();
  }

  async function make(page, name, { color = 8, icon = 'moon' } = {}) {
    await page.fill('#cond-name', name);
    await page.locator('#cond-colors button.token-swatch').nth(color).click();
    await page.locator(`#cond-icons [data-icon="${icon}"]`).click();
    await page.click('#cond-save');
  }

  test('has a Conditions tab beside Board, and the arrow keys move between the tabs', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(page.locator('#settings-panel-board')).toBeVisible();
    await expect(panel(page)).toBeHidden();
    await page.locator('#settings-tab-board').focus();
    await page.keyboard.press('ArrowDown');
    await expect(tab(page)).toBeFocused();
    await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('#settings-panel-board')).toBeHidden();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#settings-panel-board')).toBeVisible();
  });

  test('lists the sixteen defaults for reference, and says there are none of your own yet', async ({
    page,
  }) => {
    await openPanel(page);
    await expect(page.locator('#cond-default-list .cond-row')).toHaveCount(16);
    await expect(page.locator('#cond-custom-list .cond-row')).toHaveCount(0);
    await expect(page.locator('#cond-custom-empty')).toBeVisible();
  });

  test('makes one: a name, a color and an icon, with a live preview', async ({ page }) => {
    await openPanel(page);
    await page.fill('#cond-name', 'Hexed');
    await expect(page.locator('#cond-preview-name')).toHaveText('Hexed');
    await make(page, 'Hexed', { color: 8, icon: 'moon' });
    await expect(page.locator('#cond-custom-list .cond-row')).toHaveCount(1);
    await expect(page.locator('#cond-custom-list .cond-row')).toContainText('Hexed');
    await expect(page.locator('#cond-custom-empty')).toBeHidden();
    await expect(page.locator('#cond-name')).toHaveValue(''); // ready for the next
  });

  test("asks for a name, and refuses one that is taken, in any capitals, including a default's", async ({
    page,
  }) => {
    await openPanel(page);
    await page.click('#cond-save');
    await expect(page.locator('#cond-problem')).toContainText('name');
    await page.fill('#cond-name', 'prone');
    await page.click('#cond-save');
    await expect(page.locator('#cond-problem')).toContainText('already');
    await expect(page.locator('#cond-custom-list .cond-row')).toHaveCount(0);

    await make(page, 'Hexed');
    await page.fill('#cond-name', 'HEXED');
    await page.click('#cond-save');
    await expect(page.locator('#cond-problem')).toContainText('already');
    await page.fill('#cond-name', 'Hexed 2'); // typing clears the message
    await expect(page.locator('#cond-problem')).toHaveText('');
  });

  test("it appears in a token's picker and menu next to the defaults", async ({ page }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.keyboard.press('Escape');

    await select(page);
    await page.click('#token-cond-add');
    await expect(page.locator('#token-cond-grid .tc-cond')).toHaveCount(17);
    await expect(page.locator('#token-cond-grid .tc-cond').last()).toContainText('Hexed'); // after the defaults
    await choose(page, 'Hexed');
    const [custom] = await conditionsOf(page);
    expect(custom).toMatchObject({ name: 'Hexed', icon: 'moon', color: '#6d4fc7' }); // swatch 8
    expect(custom.id.startsWith('custom-')).toBe(true);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
    await page.locator('#ctx-token-conditions').hover();
    await expect(page.locator('#token-conditions-menu .ctx-cond')).toHaveCount(17);
    await expect(page.locator('#token-conditions-menu .ctx-cond', { hasText: 'Hexed' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('is kept in this browser across a reload', async ({ page }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await openPanel(page);
    await expect(page.locator('#cond-custom-list .cond-row')).toContainText('Hexed');
  });

  test('a color can be any color, with the ring', async ({ page }) => {
    await openPanel(page);
    await page.fill('#cond-name', 'Marked');
    await page.locator('#cond-colors input[type="color"]').evaluate((input) => {
      input.value = '#123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#cond-colors .token-swatch-custom')).toHaveClass(/selected/);
    await page.click('#cond-save');
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('inkstone-conditions')));
    expect(stored[0]).toMatchObject({ name: 'Marked', color: '#123456' });
  });

  test('the icons are a radio group the arrow keys move through', async ({ page }) => {
    await openPanel(page);
    await page.locator('#cond-icons [data-icon="star"]').click();
    await page.keyboard.press('ArrowLeft');
    const checked = page.locator('#cond-icons [aria-checked="true"]');
    await expect(checked).toHaveCount(1);
    await expect(checked).toBeFocused();
    await expect(checked).not.toHaveAttribute('data-icon', 'star');
  });

  test('editing one brings every token that has it up to date, in one undo step', async ({ page }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.keyboard.press('Escape');
    await select(page);
    await page.click('#token-cond-add');
    await choose(page, 'Hexed');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await openPanel(page);
    await page.getByRole('button', { name: 'Edit Hexed' }).click();
    await expect(page.locator('#cond-form-title')).toHaveText('Edit condition');
    await expect(page.locator('#cond-name')).toHaveValue('Hexed');
    await page.fill('#cond-name', 'Cursed');
    await page.locator(`#cond-icons [data-icon="skull"]`).click();
    await page.click('#cond-save');
    await expect(page.locator('#cond-custom-list .cond-row')).toContainText('Cursed');
    await expect(page.locator('#cond-form-title')).toHaveText('Add a condition');

    const [onToken] = await conditionsOf(page);
    expect(onToken).toMatchObject({ name: 'Cursed', icon: 'skull' });

    await page.keyboard.press('Escape');
    await page.click('#btn-undo'); // the whole update, at once
    const [back] = await conditionsOf(page);
    expect(back).toMatchObject({ name: 'Hexed', icon: 'moon' });
  });

  test('cancelling an edit changes nothing', async ({ page }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.getByRole('button', { name: 'Edit Hexed' }).click();
    await expect(page.locator('#cond-cancel')).toBeVisible();
    await page.fill('#cond-name', 'Something else');
    await page.click('#cond-cancel');
    await expect(page.locator('#cond-name')).toHaveValue('');
    await expect(page.locator('#cond-cancel')).toBeHidden();
    await expect(page.locator('#cond-custom-list .cond-row')).toContainText('Hexed');
  });

  test('deleting one takes it off the list, but tokens that have it keep it', async ({ page }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.keyboard.press('Escape');
    await select(page);
    await page.click('#token-cond-add');
    await choose(page, 'Hexed');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await openPanel(page);
    await page.getByRole('button', { name: 'Delete Hexed' }).click();
    await expect(page.locator('#cond-custom-list .cond-row')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('keep it');
    await page.keyboard.press('Escape');

    expect((await conditionsOf(page))[0].name).toBe('Hexed'); // still on the token
    await select(page);
    await page.click('#token-cond-add');
    await expect(page.locator('#token-cond-grid .tc-cond')).toHaveCount(16); // no longer on offer
    await expect(page.locator('#token-cond-pills')).toContainText('Hexed'); // but still its pill
  });

  test('a token keeps showing a custom condition for someone who does not have it (it is in the token)', async ({
    page,
  }) => {
    await openPanel(page);
    await make(page, 'Hexed');
    await page.keyboard.press('Escape');
    await select(page);
    await page.click('#token-cond-add');
    await choose(page, 'Hexed');
    // Someone else's browser: no custom conditions of their own, same map.
    await page.evaluate(() => localStorage.removeItem('inkstone-conditions'));
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.mouse.click(tokenAt.x, tokenAt.y);
    await expect(page.locator('#token-cond-pills')).toContainText('Hexed');
    await page.mouse.click(600, 500);
    await page.mouse.move(tokenAt.x, tokenAt.y);
    await expect(page.locator('#token-tip')).toContainText('Hexed');
  });
});

test.describe('safety', () => {
  test('a name with markup in it is shown as text, never as markup', async ({ page }) => {
    await page.click('#btn-settings');
    await page.click('#settings-tab-conditions');
    await page.fill('#cond-name', '<img src=x onerror=alert(1)>'.slice(0, 20));
    await page.click('#cond-save');
    await expect(page.locator('#cond-custom-list .cond-row')).toContainText('<img');
    expect(await page.locator('#cond-custom-list img').count()).toBe(0);
  });

  test('conditions that arrive from someone else are checked, not trusted', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem(
        'inkstone-board',
        JSON.stringify([
          {
            type: 'token',
            x: 180,
            y: 180,
            conditions: [
              { id: 'x', name: '<b>bad</b>', color: 'url(javascript:alert(1))', icon: 'moon' },
              { id: 'prone', name: 'Prone', color: '#6d4fc7', icon: 'arrow-down' },
              'junk',
            ],
          },
        ]),
      ),
    );
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.click('#tool-select');
    await page.mouse.click(tokenAt.x, tokenAt.y);
    await expect(page.locator('#token-cond-pills .tc-pill')).toHaveCount(1); // only the valid one
    await expect(page.locator('#token-cond-pills')).toContainText('Prone');
  });
});
