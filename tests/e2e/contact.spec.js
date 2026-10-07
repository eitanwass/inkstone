import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The Contact page: a message form that posts to the relay's /feedback, like the editor's feedback dialog.

async function mockFeedback(page, status = 200) {
  const posted = [];
  await page.route('**/feedback', async (route) => {
    const request = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    posted.push(JSON.parse(request.postData()));
    await route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: '{}' });
  });
  return posted;
}

test('the menu links to the page, which says what it is for', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact' }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tell us what you think');
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/eitanwass/inkstone/issues',
  );
});

test('it sends the message and says thank you, and the form goes', async ({ page }) => {
  const posted = await mockFeedback(page);
  await page.goto('/contact/');
  await page.fill('#contact-message', 'We played a whole session on it and it was lovely');
  await page.fill('#contact-email', 'dm@example.com');
  await page.click('#contact-send');
  await expect(page.locator('#contact-thanks')).toBeVisible();
  await expect(page.locator('#contact-form')).toBeHidden();
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({
    message: 'We played a whole session on it and it was lovely',
    email: 'dm@example.com',
    website: '',
    page: 'contact',
  });
  expect(posted[0]).not.toHaveProperty('map');
});

test('an empty message or a bad email is explained, and nothing is sent', async ({ page }) => {
  const posted = await mockFeedback(page);
  await page.goto('/contact/');
  await page.click('#contact-send');
  await expect(page.locator('#contact-problem')).toHaveText('Write a message first.');
  await expect(page.locator('#contact-message')).toBeFocused();
  await page.fill('#contact-message', 'hello');
  await expect(page.locator('#contact-problem')).toHaveText('');
  await page.fill('#contact-email', 'nope');
  await page.click('#contact-send');
  await expect(page.locator('#contact-problem')).toContainText("doesn't look right");
  expect(posted).toHaveLength(0);
});

test('when it cannot be sent it says so and keeps the message', async ({ page }) => {
  await mockFeedback(page, 500);
  await page.goto('/contact/');
  await page.fill('#contact-message', 'Please keep this');
  await page.click('#contact-send');
  await expect(page.locator('#contact-problem')).toContainText("Couldn't send that");
  await expect(page.locator('#contact-message')).toHaveValue('Please keep this');
  await expect(page.locator('#contact-send')).toBeEnabled();
  await expect(page.locator('#contact-send')).toHaveText('Send message');
});

test('the page works on a phone and has no accessibility problems', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact/');
  const box = await page.locator('#contact-message').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
