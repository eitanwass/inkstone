import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The feedback dialog: the speech-bubble button in the top bar opens a form that posts to the relay's /feedback.

const modal = (page) => page.locator('#feedback-modal');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

// Stands in for the relay's /feedback, recording what was posted and answering with `status`.
async function mockFeedback(page, status = 200) {
  const posted = [];
  await page.route('**/feedback', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      });
      return;
    }
    posted.push(JSON.parse(request.postData()));
    await route.fulfill({
      status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(status === 200 ? { ok: true } : { error: 'x' }),
    });
  });
  return posted;
}

async function openFeedback(page) {
  await page.click('#btn-feedback');
  await expect(modal(page)).toBeVisible();
}

test('the speech-bubble button opens a dialog with a message, an email, and a choice to attach the map', async ({
  page,
}) => {
  await expect(page.locator('#btn-feedback')).toHaveAccessibleName('Send feedback');
  await openFeedback(page);
  await expect(modal(page).getByRole('heading', { name: 'Send feedback' })).toBeVisible();
  await expect(page.getByLabel('Your message')).toBeVisible();
  await expect(page.getByLabel(/Email/)).toBeVisible();
  await expect(page.locator('#feedback-attach')).toBeDisabled(); // nothing on the map to attach yet
  await expect(page.locator('.feedback-attach small')).toHaveText(
    'There is nothing on the map to attach yet.',
  );
  await page.keyboard.press('Escape');
  await expect(modal(page)).toBeHidden();
  await expect(page.locator('#btn-feedback')).toBeFocused();
});

test('it sends the message with the version and where it came from, then says thank you', async ({
  page,
}) => {
  const posted = await mockFeedback(page);
  await openFeedback(page);
  await page.fill('#feedback-message', 'The wall tool is lovely');
  await page.fill('#feedback-email', 'dm@example.com');
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-thanks')).toContainText('Thank you');

  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({
    message: 'The wall tool is lovely',
    email: 'dm@example.com',
    website: '',
    page: 'editor',
  });
  expect(posted[0].version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(posted[0].screen).toMatch(/^\d+x\d+$/);
  expect(posted[0]).not.toHaveProperty('map'); // not attached

  await page.click('#feedback-thanks button');
  await expect(modal(page)).toBeHidden();

  // The next time it is a fresh form.
  await openFeedback(page);
  await expect(page.locator('#feedback-message')).toHaveValue('');
});

test('an empty message, or an email that is not one, is explained and nothing is sent', async ({ page }) => {
  const posted = await mockFeedback(page);
  await openFeedback(page);
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-problem')).toHaveText('Write a message first.');

  await page.fill('#feedback-message', 'hello');
  await expect(page.locator('#feedback-problem')).toHaveText(''); // typing clears it
  await page.fill('#feedback-email', 'nope');
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-problem')).toContainText("doesn't look right");
  expect(posted).toHaveLength(0);
});

test('the map is attached only when the box is ticked', async ({ page }) => {
  const posted = await mockFeedback(page);
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, 160, 120);

  await openFeedback(page);
  await expect(page.locator('#feedback-attach')).toBeEnabled();
  await page.fill('#feedback-message', 'It does not do what I expect');
  await page.check('#feedback-attach');
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-thanks')).toBeVisible();
  const map = JSON.parse(posted[0].map);
  expect(map.elements).toHaveLength(1);
  expect(map.elements[0].type).toBe('rect');
});

test('when it cannot be sent it says why, keeps what was written, and can be tried again', async ({
  page,
}) => {
  await mockFeedback(page, 500);
  await openFeedback(page);
  await page.fill('#feedback-message', 'Please keep this');
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-problem')).toContainText("Couldn't send that");
  await expect(page.locator('#feedback-message')).toHaveValue('Please keep this');
  await expect(page.locator('#feedback-send')).toBeEnabled();
});

test('a site with feedback not set up, or a visitor sending too many, is told so plainly', async ({
  page,
}) => {
  await page.route('**/feedback', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      });
      return;
    }
    await route.fulfill({
      status: 501,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{"error":"not-set-up"}',
    });
  });
  await openFeedback(page);
  await page.fill('#feedback-message', 'hello');
  await page.click('#feedback-send');
  await expect(page.locator('#feedback-problem')).toHaveText("Feedback isn't set up on this site yet.");
});

test('the hidden field is filled in by scripts, so a form that has it filled is sent on as it is', async ({
  page,
}) => {
  const posted = await mockFeedback(page);
  await openFeedback(page);
  await page.fill('#feedback-message', 'hello');
  await page.locator('.feedback-trap').fill('http://spam.example');
  await page.click('#feedback-send');
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0].website).toBe('http://spam.example'); // the relay is what ignores it
  await expect(page.locator('.feedback-trap')).toHaveAttribute('aria-hidden', 'true');
});

test('the dialog has no accessibility problems', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFeedback(page);
  const results = await new AxeBuilder({ page }).include('#feedback-modal').analyze();
  expect(results.violations).toEqual([]);
});
