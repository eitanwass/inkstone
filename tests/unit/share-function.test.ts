import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, personalize } from '../../api/share';

// The page as built: index.html with the %SITE_URL% placeholder filled in.
const PAGE = readFileSync('index.html', 'utf8').replaceAll('%SITE_URL%', 'https://inkstone.example');
const ORIGIN = 'https://inkstone.example';

const decode = (text: string) =>
  text.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

// The content of a <meta> tag as a browser would read it (entities decoded).
function meta(html: string, attr: string, value: string): string | undefined {
  const tag = new RegExp(`<meta\\b[^>]*\\b${attr}="${value}"[^>]*\\bcontent="([^"]*)"`);
  const raw = tag.exec(html)?.[1];
  return raw === undefined ? undefined : decode(raw);
}

// Everything the function is allowed to change: the title and the preview tags.
const withoutPreviewTags = (html: string) =>
  html.replace(/<meta\b[^>]*(?:og:|twitter:image)[^>]*>|<title>[^<]*<\/title>/g, '');

describe('personalize', () => {
  const page = `${ORIGIN}/?session=abc&map=The+Sunken+Crypt`;
  const html = personalize(PAGE, 'The Sunken Crypt', ORIGIN, page);

  it('puts the map name in the title and the preview tags', () => {
    expect(html).toContain('<title>The Sunken Crypt – Inkstone</title>');
    expect(meta(html, 'property', 'og:title')).toBe('The Sunken Crypt – Inkstone');
    expect(meta(html, 'property', 'og:description')).toMatch(/Join this map/);
    expect(meta(html, 'property', 'og:image:alt')).toContain('The Sunken Crypt');
    expect(meta(html, 'property', 'og:url')).toBe(page);
  });

  it('points the preview image at the per-map image endpoint, on the same site', () => {
    const image = `${ORIGIN}/api/og?name=The%20Sunken%20Crypt`;
    expect(meta(html, 'property', 'og:image')).toBe(image);
    expect(meta(html, 'name', 'twitter:image')).toBe(image);
  });

  it('leaves the rest of the page exactly as it was', () => {
    expect(withoutPreviewTags(html)).toBe(withoutPreviewTags(PAGE));
    expect(meta(html, 'property', 'og:site_name')).toBe('Inkstone');
    expect(meta(html, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'property', 'og:image:width')).toBe('1200');
  });

  it('encodes the name in the image address, so it can not add parameters or break out', () => {
    const out = personalize(PAGE, 'a&b=c#d?e/f', ORIGIN, page);
    expect(meta(out, 'property', 'og:image')).toBe(`${ORIGIN}/api/og?name=a%26b%3Dc%23d%3Fe%2Ff`);
  });

  it('escapes the name, so it can not break out of an attribute or inject markup', () => {
    const nasty = '"><script>alert(1)</script><meta x="';
    const out = personalize(PAGE, nasty, ORIGIN, page);
    expect(out).not.toContain('<script>alert');
    expect(out.match(/<script\b/g)?.length).toBe(PAGE.match(/<script\b/g)?.length); // no new script tags
    expect(out).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'); // escaped in the source...
    expect(meta(out, 'property', 'og:title')).toBe(`${nasty} – Inkstone`); // ...and read back as typed
  });

  it('does not trip over characters that String.replace treats specially', () => {
    const out = personalize(PAGE, "$& $1 $` $' $$", ORIGIN, page);
    expect(meta(out, 'property', 'og:title')).toBe("$& $1 $` $' $$ – Inkstone");
  });
});

describe('GET /?map=...', () => {
  // The function fetches the static page itself, so the test answers that fetch.
  const serve = (answer: (url: URL) => string | Response = () => PAGE) =>
    vi.stubGlobal('fetch', async (url: URL) => {
      const result = answer(url);
      return typeof result === 'string' ? new Response(result) : result;
    });
  afterEach(() => vi.unstubAllGlobals());
  const request = (query: string) => new Request(`${ORIGIN}/${query}`);

  it('serves the page with the named preview tags', async () => {
    serve();
    const response = await GET(request('?session=abc&map=The%20Sunken%20Crypt'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    const html = await response.text();
    expect(html).toContain('<title>The Sunken Crypt – Inkstone</title>');
    expect(meta(html, 'property', 'og:image')).toBe(`${ORIGIN}/api/og?name=The%20Sunken%20Crypt`);
    expect(meta(html, 'property', 'og:url')).toBe(`${ORIGIN}/?session=abc&map=The%20Sunken%20Crypt`);
  });

  it('fetches the static page from the same site', async () => {
    const asked: string[] = [];
    serve((url) => {
      asked.push(url.href);
      return PAGE;
    });
    await GET(request('?map=x'));
    expect(asked).toEqual([`${ORIGIN}/index.html`]);
  });

  it('treats the name like every other map name: tidied and cut to 60 characters', async () => {
    const query = `?map=${encodeURIComponent(`  A   B ${'x'.repeat(100)}`)}`;
    serve();
    const html = await (await GET(request(query))).text();
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    expect(title.endsWith(' – Inkstone')).toBe(true);
    expect(title.replace(' – Inkstone', '').length).toBeLessThanOrEqual(60);
    expect(title).toContain('A B x');
  });

  it('serves the page unchanged when the name is empty or only whitespace', async () => {
    serve();
    for (const query of ['?map=', '?map=%20%20', '?map=%00%01']) {
      const response = await GET(request(`${query}&session=abc`));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(PAGE);
    }
  });

  it('redirects to the same link without ?map= if the page can not be loaded, so the app still opens', async () => {
    serve(() => {
      throw new Error('offline');
    });
    const response = await GET(request('?session=abc&map=The%20Sunken%20Crypt'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/?session=abc`);
  });

  it('lets browsers and the CDN cache it briefly', async () => {
    serve();
    const response = await GET(request('?map=x'));
    expect(response.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
  });

  it('ignores a second argument: Vercel passes its own, which must not be mistaken for anything', async () => {
    serve();
    const response = await (GET as (r: Request, extra: unknown) => Promise<Response>)(
      request('?session=abc&map=The%20Sunken%20Crypt'),
      { waitUntil() {} },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>The Sunken Crypt – Inkstone</title>');
  });
});
