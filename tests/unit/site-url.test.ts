import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '../../scripts/site-url';

describe('resolveSiteUrl', () => {
  it("turns Vercel's bare production domain into an https URL", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app' })).toBe(
      'https://inkstone-app.vercel.app',
    );
  });

  it('does not double the protocol if one is already there', () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'https://inkstone-app.vercel.app' })).toBe(
      'https://inkstone-app.vercel.app',
    );
    expect(resolveSiteUrl({ SITE_URL: 'https://inkstone.example' })).toBe('https://inkstone.example');
  });

  it('adds https to a SITE_URL that has none', () => {
    expect(resolveSiteUrl({ SITE_URL: 'inkstone.example' })).toBe('https://inkstone.example');
  });

  it('keeps an explicit http address, for previewing a build locally', () => {
    expect(resolveSiteUrl({ SITE_URL: 'http://localhost:4173' })).toBe('http://localhost:4173');
  });

  it('drops trailing slashes and surrounding whitespace', () => {
    expect(resolveSiteUrl({ SITE_URL: ' https://inkstone.example/// ' })).toBe('https://inkstone.example');
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app/' })).toBe(
      'https://inkstone-app.vercel.app',
    );
  });

  it('prefers SITE_URL over the Vercel domain', () => {
    expect(
      resolveSiteUrl({
        SITE_URL: 'https://inkstone.example',
        VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app',
      }),
    ).toBe('https://inkstone.example');
  });

  it('falls back to the Vercel domain when SITE_URL is empty or blank', () => {
    expect(resolveSiteUrl({ SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app' })).toBe(
      'https://inkstone-app.vercel.app',
    );
    expect(
      resolveSiteUrl({ SITE_URL: '   ', VERCEL_PROJECT_PRODUCTION_URL: 'inkstone-app.vercel.app' }),
    ).toBe('https://inkstone-app.vercel.app');
  });

  it('is empty when nothing is set, which leaves the URLs relative', () => {
    expect(resolveSiteUrl({})).toBe('');
    expect(resolveSiteUrl({ SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBe('');
    expect(resolveSiteUrl({ SITE_URL: '/' })).toBe('');
  });
});
