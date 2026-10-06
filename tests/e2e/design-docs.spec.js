import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

// design/DESIGN.md and design/style-guide.html describe values that live in the
// code. These tests fail when the code changes and the docs are left behind.

const read = (file) => readFileSync(file, 'utf8');
const squash = (text) => text.replace(/\s+/g, '').toLowerCase();

const design = read('design/DESIGN.md');
const guide = read('design/style-guide.html');
const readAll = (dir) =>
  readdirSync(dir)
    .map((f) => read(`${dir}/${f}`))
    .join('\n');
const css = readAll('src/styles');

const rootTokens = [...css.match(/:root\s*\{([^}]*)\}/)[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => ({
  name: m[1],
  value: m[2].trim(),
}));

test('every :root token in src/styles/ is documented, with its current value', () => {
  expect(rootTokens.length).toBeGreaterThan(10);
  for (const { name, value } of rootTokens) {
    expect(design, `DESIGN.md should mention ${name}`).toContain(name);
    expect(squash(design), `DESIGN.md should state ${name}: ${value}`).toContain(squash(value));
  }
});

test('the style guide shows every colour token', () => {
  for (const { name, value } of rootTokens.filter((t) => /^#[0-9a-f]{6}$/i.test(t.value))) {
    expect(guide.toLowerCase(), `style-guide.html should show ${name} (${value})`).toContain(
      value.toLowerCase(),
    );
  }
});

test('the drawing palettes and token colours in the app are documented', () => {
  const swatches = [
    ...[read('draw/index.html'), readAll('html')].join('\n').matchAll(/data-color="(#[0-9a-f]{6})"/gi),
  ].map((m) => m[1]);
  const tokenColors = [
    ...read('src/elements/token.ts')
      .match(/PALETTE = \[([^\]]*)\]/)[1]
      .matchAll(/#[0-9a-f]{6}/gi),
  ].map((m) => m[0]);
  expect(swatches.length).toBeGreaterThanOrEqual(11);
  expect(tokenColors.length).toBe(8);
  for (const hex of [...new Set([...swatches, ...tokenColors])]) {
    expect(design.toLowerCase(), `DESIGN.md should list ${hex}`).toContain(hex.toLowerCase());
    expect(guide.toLowerCase(), `style-guide.html should list ${hex}`).toContain(hex.toLowerCase());
  }
});

test('the documented fonts match the ones the app bundles and the canvas uses', () => {
  const main = read('src/main.ts');
  expect(main).toContain("'@fontsource-variable/inter'");
  expect(main).toContain("'@fontsource/eb-garamond/500.css'");
  expect(design).toContain('EB Garamond');
  expect(design).toContain('Inter');
  expect(read('src/core/state.ts')).toContain("'Inter Variable'");
});

test('every relative link in DESIGN.md points at a file that exists', () => {
  const links = [...design.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1].split('#')[0])
    .filter((target) => target && !/^[a-z]+:/.test(target));
  expect(links.length).toBeGreaterThan(5);
  for (const target of links) {
    expect(existsSync(resolve(dirname('design/DESIGN.md'), target)), `broken link: ${target}`).toBe(true);
  }
});
