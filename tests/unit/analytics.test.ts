import { describe, expect, it } from 'vitest';
import { analyticsTags, resolveAnalyticsToken } from '../../scripts/analytics';

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('resolveAnalyticsToken', () => {
  it('takes a token of the right shape, trimmed', () => {
    expect(resolveAnalyticsToken({ CF_ANALYTICS_TOKEN: TOKEN })).toBe(TOKEN);
    expect(resolveAnalyticsToken({ CF_ANALYTICS_TOKEN: `  ${TOKEN.toUpperCase()}\n` })).toBe(
      TOKEN.toUpperCase(),
    );
  });

  it('is empty when there is none, or it is not a token (so nothing odd is put in a page)', () => {
    for (const bad of [
      undefined,
      '',
      '   ',
      'abc',
      `${TOKEN}0`,
      TOKEN.slice(1),
      `"><script>alert(1)</script>${TOKEN}`,
    ]) {
      expect(resolveAnalyticsToken({ CF_ANALYTICS_TOKEN: bad })).toBe('');
    }
  });
});

describe('analyticsTags', () => {
  it('adds Cloudflare’s beacon to the end of the page, with the token', () => {
    const [tag, ...rest] = analyticsTags(TOKEN);
    expect(rest).toEqual([]);
    expect(tag).toMatchObject({ tag: 'script', injectTo: 'body' });
    expect(tag.attrs?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(tag.attrs?.type).toBe('module'); // a module script waits for the page, like defer
    expect(JSON.parse(String(tag.attrs?.['data-cf-beacon']))).toEqual({ token: TOKEN });
  });

  it('adds nothing without a token', () => {
    expect(analyticsTags('')).toEqual([]);
  });
});
