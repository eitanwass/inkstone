// GET /api/og?name=The+Sunken+Crypt: the link-preview image for a named map.
//
// Anything it can't draw (no name, a name in a script the bundled fonts don't
// cover, or any rendering failure) redirects to the plain site card instead, so a
// link preview always has an image.

import { normalizeMapName } from '../src/map-name-text.js';
import { isDrawable, renderCard } from './_card.js';

const DEFAULT_CARD = '/og-image.png';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const fallback = () => Response.redirect(new URL(DEFAULT_CARD, url), 302);

  // The name arrives in a URL anyone can write, so it is cleaned and bounded
  // like every other map name before it is drawn.
  const name = normalizeMapName(url.searchParams.get('name'));
  if (!name || !isDrawable(name)) return fallback();

  try {
    const png = await renderCard(name);
    return new Response(new Blob([png], { type: 'image/png' }), {
      headers: {
        'content-type': 'image/png',
        // The same name always gives the same image, so let the CDN and the chat apps keep it.
        'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return fallback();
  }
}
