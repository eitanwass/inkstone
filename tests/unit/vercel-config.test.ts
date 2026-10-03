import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_FILES } from '../../api/_card';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

describe('vercel.json', () => {
  it('still skips deploys that do not change the version', () => {
    expect(config.ignoreCommand).toBe('node scripts/should-deploy.mjs');
  });

  it('sends the app link, when it carries a map name, through the function that fills in the preview tags', () => {
    expect(config.rewrites).toContainEqual({
      source: '/',
      has: [{ type: 'query', key: 'map' }],
      destination: '/api/share',
    });
  });

  it('ships every file the image function reads, and sets a time limit', () => {
    const { includeFiles, maxDuration } = config.functions['api/og.ts'];
    // balanced braces, or the glob would not mean what it says
    expect([...includeFiles].filter((c) => c === '{').length).toBe(
      [...includeFiles].filter((c) => c === '}').length,
    );
    // each runtime file's folder is covered
    for (const file of RUNTIME_FILES) {
      const folder = file.slice(0, file.lastIndexOf('/'));
      expect(includeFiles, `includeFiles should cover ${file}`).toContain(folder);
    }
    expect(maxDuration).toBeGreaterThan(0);
  });

  it('only rewrites the root path, so the app and its assets are served as before', () => {
    for (const rewrite of config.rewrites) expect(rewrite.source).toBe('/');
  });
});
