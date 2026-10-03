// GET /join?session=...&map=The+Sunken+Crypt (rewritten here by vercel.json): the
// app's page, with the link-preview tags filled in for that map.
//
// Chat apps read a link's preview tags without running any JavaScript, and the
// map's name only exists inside the running app, so the name travels in the link
// (?map=...) and this function writes it into the page's tags and points the
// preview image at /api/og. Invite links live under /join because a rewrite can't
// take over "/": Vercel serves the static index.html for that path before it looks
// at rewrites. Everyone who opens a /join link gets this page (the app itself is
// unchanged), so if anything goes wrong it redirects to "/" with the same session,
// which the static page serves, and says why in an `x-share-fallback` header.

import { normalizeMapName } from '../src/map-name-text.js';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A header value is a single line of plain ASCII.
const headerSafe = (text: string) => text.replace(/[^\x20-\x7e]+/g, ' ').slice(0, 300);

// Rewrites the content="..." of the <meta> tag identified by an attribute such as property="og:title".
function setMeta(html: string, attribute: string, value: string, content: string): string {
  const tag = new RegExp(`(<meta\\b[^>]*\\b${attribute}="${value}"[^>]*\\bcontent=")[^"]*(")`);
  return html.replace(
    tag,
    (_all, before: string, after: string) => `${before}${escapeHtml(content)}${after}`,
  );
}

// The page's HTML with the preview tags describing the map called `name`.
export function personalize(html: string, name: string, origin: string, pageUrl: string): string {
  const image = `${origin}/api/og?name=${encodeURIComponent(name)}`;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(name)} – Inkstone</title>`);
  out = setMeta(out, 'property', 'og:title', `${name} – Inkstone`);
  out = setMeta(out, 'property', 'og:description', 'Join this map on Inkstone and draw it together, live.');
  out = setMeta(out, 'property', 'og:url', pageUrl);
  out = setMeta(out, 'property', 'og:image', image);
  out = setMeta(out, 'property', 'og:image:alt', `Inkstone: the map "${name}"`);
  out = setMeta(out, 'name', 'twitter:image', image);
  return out;
}

type FetchPage = (url: URL) => Promise<string>;

const fetchPage: FetchPage = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url.pathname} answered ${response.status}`);
  return response.text();
};

// `loadPage` exists so tests can supply the page instead of fetching it.
export async function GET(request: Request, loadPage: FetchPage = fetchPage): Promise<Response> {
  const url = new URL(request.url);
  const name = normalizeMapName(url.searchParams.get('map'));

  // Back to the plain app: the root path (this function's own path would loop),
  // keeping the session so the link still joins the right map.
  const fallback = (reason: string) => {
    const home = new URL('/', url);
    const session = url.searchParams.get('session');
    if (session) home.searchParams.set('session', session);
    return new Response(null, {
      status: 302,
      headers: { location: home.href, 'x-share-fallback': headerSafe(reason), 'cache-control': 'no-store' },
    });
  };

  try {
    // /index.html is served as a static file, so fetching it doesn't come back here.
    const html = await loadPage(new URL('/index.html', url));
    const body = name ? personalize(html, name, url.origin, url.toString()) : html;
    return new Response(body, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return fallback(`${message} (host ${url.host})`);
  }
}
