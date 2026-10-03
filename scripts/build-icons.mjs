// Builds the site's icon files from the SVG sources in design/logo/.
//
//   npm run build:icons
//
// Writes into public/ (committed, so a normal build never needs this):
//   logo.svg                the full mark, shown in the app's corner
//   favicon.svg             the simplified small-size mark, for modern browsers
//   favicon.ico             16/32/48px, for everything else
//   apple-touch-icon.png    180px, opaque (iOS adds its own rounding)
//   icon-192.png / icon-512.png   home-screen icons (Android, installable web apps)
//
// The SVGs are rasterized with Playwright's Chromium, which is already a
// dev dependency for the tests.

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SOURCE = 'design/logo';
const OUT = 'public';

copyFileSync(`${SOURCE}/logo.svg`, `${OUT}/logo.svg`);
copyFileSync(`${SOURCE}/favicon.svg`, `${OUT}/favicon.svg`);

const browser = await chromium.launch();
const page = await browser.newPage();

// The SVG at size x size as a PNG, with a transparent background where the SVG has none.
async function render(svgFile, size) {
  const svg = readFileSync(`${SOURCE}/${svgFile}`, 'utf8');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block}</style>` +
      `<img src="${src}" width="${size}" height="${size}">`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

// An .ico is a small header plus one directory entry per image; modern ICOs can
// hold PNG data directly.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = header.length + entries.length;
  images.forEach(({ size, png }, i) => {
    const at = i * 16;
    entries.writeUInt8(size, at); // width (256 would be 0; we stop at 48)
    entries.writeUInt8(size, at + 1); // height
    entries.writeUInt16LE(1, at + 4); // colour planes
    entries.writeUInt16LE(32, at + 6); // bits per pixel
    entries.writeUInt32LE(png.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, entries, ...images.map((i) => i.png)]);
}

const icoImages = [];
for (const size of [16, 32, 48]) icoImages.push({ size, png: await render('favicon.svg', size) });
writeFileSync(`${OUT}/favicon.ico`, buildIco(icoImages));

writeFileSync(`${OUT}/apple-touch-icon.png`, await render('icon-fullbleed.svg', 180));
writeFileSync(`${OUT}/icon-192.png`, await render('icon-fullbleed.svg', 192));
writeFileSync(`${OUT}/icon-512.png`, await render('icon-fullbleed.svg', 512));

await browser.close();
console.log('Icons written to public/.');
