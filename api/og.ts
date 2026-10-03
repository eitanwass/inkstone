// GET /api/og?name=The+Sunken+Crypt: the link-preview image for a named map.
//
// Anything it can't draw (no name, a name in a script the bundled fonts don't
// cover, or any failure at all, including the renderer failing to load) redirects
// to the plain site card instead, so a link preview always has an image. The
// redirect says why in an `x-og-fallback` header, which is how a problem on the
// server can be read with `curl -i` without access to its logs.

import { normalizeMapName } from '../src/map-name-text.js';

const DEFAULT_CARD = '/og-image.png';

// A header value is a single line of plain ASCII.
const headerSafe = (text: string) => text.replace(/[^\x20-\x7e]+/g, ' ').slice(0, 300);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const fallback = (reason: string, cache = 'public, max-age=3600') =>
    new Response(null, {
      status: 302,
      headers: {
        location: new URL(DEFAULT_CARD, url).href,
        'x-og-fallback': headerSafe(reason),
        'cache-control': cache,
      },
    });

  // The name arrives in a URL anyone can write, so it is cleaned and bounded
  // like every other map name before it is drawn.
  const name = normalizeMapName(url.searchParams.get('name'));
  if (!name) return fallback('no-name');

  try {
    // Loaded here, not at the top of the file, so that if the renderer or its fonts
    // can't be loaded the failure lands in this catch (and becomes the site card)
    // instead of crashing the function before it can answer.
    const { isDrawable, renderCard } = await import('./_card.js');
    if (!isDrawable(name)) return fallback('not-drawable');
    const png = await renderCard(name);
    return new Response(new Blob([png], { type: 'image/png' }), {
      headers: {
        'content-type': 'image/png',
        // The same name always gives the same image, so let the CDN and the chat apps keep it.
        'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return fallback(`error: ${message}`, 'no-store');
  }
}
