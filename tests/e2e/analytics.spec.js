import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// The page-view counter (Cloudflare Web Analytics) is in a production build that has a token, on every
// page, and nowhere else: not in development, not in a build without a token, and never a bad token.

const TOKEN = '0123456789abcdef0123456789abcdef';
const BEACON = 'static.cloudflareinsights.com/beacon.min.js';
const PAGES = ['index.html', 'draw/index.html', 'docs/index.html'];

function build(env) {
  const out = mkdtempSync(join(tmpdir(), 'inkstone-analytics-'));
  try {
    execFileSync(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'],
      {
        env: { ...process.env, CF_ANALYTICS_TOKEN: '', ...env },
        stdio: 'ignore',
      },
    );
    return Object.fromEntries(PAGES.map((page) => [page, readFileSync(join(out, page), 'utf8')]));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

test('a build with a token puts the beacon on the home page, the editor and the docs', () => {
  const pages = build({ CF_ANALYTICS_TOKEN: TOKEN });
  for (const page of PAGES) {
    expect(pages[page], page).toContain(BEACON);
    expect(pages[page], page).toContain(TOKEN);
    expect(pages[page].split(BEACON), page).toHaveLength(2); // once
  }
});

test('a build without a token, or with one that is not a token, has no beacon', () => {
  for (const env of [
    {},
    { CF_ANALYTICS_TOKEN: 'not-a-token' },
    { CF_ANALYTICS_TOKEN: `"><script>x</script>${TOKEN}` },
  ]) {
    const pages = build(env);
    for (const page of PAGES)
      expect(pages[page], `${page} ${JSON.stringify(env)}`).not.toContain('cloudflareinsights');
  }
});

test('the development server never adds it', async ({ request }) => {
  for (const url of ['/', '/draw/', '/docs/']) {
    const html = await (await request.get(url)).text();
    expect(html, url).not.toContain('cloudflareinsights');
  }
});
