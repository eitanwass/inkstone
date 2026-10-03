// Renders the share-link preview card (1200x630) from design/share-preview/template.html.
//
//   npm run build:og
//
// Writes:
//   public/og-image.png                          the site card, linked from index.html
//   design/share-preview/example-named.png       a sample of the named-map card (not shipped)
//
// The template shows a map's name when given ?name=..., so the same design can
// later be used to render a preview for a particular map.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const TEMPLATE = pathToFileURL(resolve('design/share-preview/template.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

async function render(out, name) {
  await page.goto(name ? `${TEMPLATE}?name=${encodeURIComponent(name)}` : TEMPLATE);
  await page.waitForFunction(() => window.__ready === true);
  await page.screenshot({ path: out });
  console.log(`Wrote ${out}`);
}

await render('public/og-image.png');
await render('design/share-preview/example-named.png', 'The Sunken Crypt of Vael');

await browser.close();
