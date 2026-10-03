// The address the site is served from, used to build the absolute URLs in the
// link-preview tags (chat apps won't show a preview image given a relative one).
//
// SITE_URL wins if set; otherwise Vercel's production domain (it provides
// VERCEL_PROJECT_PRODUCTION_URL during builds, as a bare domain such as
// "inkstone-app.vercel.app"); otherwise "", which leaves the URLs relative
// (fine for local development). Either value may come with or without a
// protocol and with a trailing slash; the result always has a protocol and
// never a trailing slash.

interface SiteUrlEnv {
  SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

export function resolveSiteUrl(env: SiteUrlEnv): string {
  const raw = (env.SITE_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || '').replace(/\/+$/, '');
  if (!raw) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}
