// The page-view counter: Cloudflare Web Analytics, which is free, sets no cookies and follows nobody
// across sites. It counts visits and page views (and where they come from, and the country), and
// never sees a map. It is added to the four pages (home, editor, docs, contact) only in a production build
// that has a token: CF_ANALYTICS_TOKEN, the site's token from Cloudflare (Analytics & Logs, Web
// Analytics, Add a site; set it in Vercel's environment variables, then redeploy). Without one
// (development, tests, a fork) nothing is added and nothing is sent.

import type { HtmlTagDescriptor } from 'vite';

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const TOKEN_RE = /^[a-f0-9]{32}$/i; // what a token looks like; anything else is dropped, not put in a page

interface AnalyticsEnv {
  CF_ANALYTICS_TOKEN?: string;
}

// The token if there is a usable one, else "".
export function resolveAnalyticsToken(env: AnalyticsEnv): string {
  const token = env.CF_ANALYTICS_TOKEN?.trim() ?? '';
  return TOKEN_RE.test(token) ? token : '';
}

// What to add to a page's body for a token: nothing for "".
export function analyticsTags(token: string): HtmlTagDescriptor[] {
  if (!token) return [];
  return [
    {
      tag: 'script',
      attrs: { type: 'module', src: BEACON_SRC, 'data-cf-beacon': JSON.stringify({ token }) }, // as Cloudflare gives it
      injectTo: 'body',
    },
  ];
}
