// Fails if CHANGELOG.md doesn't describe the version in package.json: the top
// entry must match it and have at least one bullet. Run in CI, so a version
// bump (which is what triggers a deploy) can't ship without release notes.

import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const lines = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);

const topIndex = lines.findIndex((line) => line.startsWith('## '));
const top = topIndex === -1 ? null : /^##\s+(\S+)/.exec(lines[topIndex])?.[1];

if (top !== version) {
  console.error(`CHANGELOG.md's top entry is ${top ?? 'missing'}, but package.json is ${version}.`);
  console.error(`Add a "## ${version} - YYYY-MM-DD" section at the top of CHANGELOG.md.`);
  process.exit(1);
}

const nextHeading = lines.findIndex((line, i) => i > topIndex && line.startsWith('## '));
const section = lines.slice(topIndex + 1, nextHeading === -1 ? undefined : nextHeading);
if (!section.some((line) => /^[-*]\s+\S/.test(line))) {
  console.error(`CHANGELOG.md's ${version} entry has no bullets.`);
  process.exit(1);
}

console.log(`CHANGELOG.md covers ${version}.`);
