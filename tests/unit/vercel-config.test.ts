import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_FILES } from '../../api/_card';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

describe('vercel.json', () => {
  it('still skips deploys that do not change the version', () => {
    expect(config.ignoreCommand).toBe('node scripts/should-deploy.mjs');
  });

  it('sends invite links (/join) through the function that fills in the preview tags', () => {
    expect(config.rewrites).toContainEqual({ source: '/join', destination: '/api/share' });
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

  it('only rewrites paths that have no static file, because a file is served before any rewrite is consulted', () => {
    // This is how the first design failed in production: rewriting "/" never fired, since
    // Vercel serves the static index.html for "/" before it looks at rewrites.
    for (const { source } of config.rewrites) {
      expect(source, 'the root path is always a static file').not.toBe('/');
      expect(existsSync(`public${source}`), `public${source} would shadow the rewrite`).toBe(false);
      expect(existsSync(`public${source}.html`), `public${source}.html would shadow the rewrite`).toBe(false);
      expect(existsSync(`public${source}/index.html`), `public${source}/index.html would shadow it`).toBe(
        false,
      );
    }
  });

  it('keeps the app and its assets out of the rewrites', () => {
    expect(config.rewrites.map((r: { source: string }) => r.source)).toEqual(['/join']);
  });
});
