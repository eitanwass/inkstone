import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as og } from '../../api/og';
import { GET as share } from '../../api/share';

// The whole link-preview chain, minus Vercel itself: a small server stands in for
// it, serving the static page and sending "/join" to the share function the
// way vercel.json's rewrite does. Then it plays a chat app: fetch the invite link,
// read the preview tags, fetch the image they point at.

const PAGE = readFileSync('index.html', 'utf8').replaceAll('%SITE_URL%', '');
let pageStatus = 200;
let server: Server;
let origin = '';

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', origin);
  const request = new Request(url);
  let response: Response;
  if (url.pathname === '/index.html') {
    response = new Response(pageStatus === 200 ? PAGE : 'broken', {
      status: pageStatus,
      headers: { 'content-type': 'text/html' },
    });
  } else if (url.pathname === '/join') {
    response = await share(request); // the rewrite in vercel.json
  } else if (url.pathname === '/api/og') {
    response = await og(request);
  } else if (url.pathname === '/') {
    response = new Response(PAGE, { headers: { 'content-type': 'text/html' } });
  } else {
    response = new Response('not found', { status: 404 });
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

beforeAll(async () => {
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const metaContent = (html: string, attr: string, value: string) =>
  new RegExp(`<meta\\b[^>]*\\b${attr}="${value}"[^>]*\\bcontent="([^"]*)"`).exec(html)?.[1];

describe('an invite link for a named map', () => {
  it('gets preview tags with the name, and the image they point at is that map’s card', async () => {
    const link = `${origin}/join?session=abc123&map=${encodeURIComponent('The Sunken Crypt')}`;
    const page = await fetch(link);
    expect(page.status).toBe(200);
    const html = await page.text();

    expect(html).toContain('<title>The Sunken Crypt – Inkstone</title>');
    expect(metaContent(html, 'property', 'og:title')).toBe('The Sunken Crypt – Inkstone');

    const imageUrl = metaContent(html, 'property', 'og:image') ?? '';
    expect(imageUrl).toBe(`${origin}/api/og?name=The%20Sunken%20Crypt`);
    const image = await fetch(imageUrl);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    const png = Buffer.from(await image.arrayBuffer());
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('is still the app: the same scripts and styles as the plain page', async () => {
    const html = await (await fetch(`${origin}/join?session=abc&map=Anything`)).text();
    const assets = (text: string) => [...text.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]).sort();
    const plainAssets = assets(await (await fetch(`${origin}/`)).text());
    for (const asset of plainAssets.filter((a) => /\.(js|ts|css)$/.test(a)))
      expect(assets(html)).toContain(asset);
  });

  it('a link with no name gets the ordinary site card', async () => {
    const html = await (await fetch(`${origin}/join?session=abc`)).text();
    expect(html).toBe(PAGE);
    expect(metaContent(html, 'property', 'og:image')).toMatch(/\/og-image\.png$/);
  });

  it('a name the card can not draw falls back to the site card, not a broken image', async () => {
    const link = `${origin}/join?session=abc&map=${encodeURIComponent('מערת הגובלינים')}`;
    const html = await (await fetch(link)).text();
    const imageUrl = metaContent(html, 'property', 'og:image') ?? '';
    const image = await fetch(imageUrl, { redirect: 'manual' });
    expect(image.status).toBe(302);
    expect(new URL(image.headers.get('location') ?? '').pathname).toBe('/og-image.png');
  });

  it('if the page can not be loaded, the link redirects to itself without the name, so the app still opens', async () => {
    pageStatus = 500;
    try {
      const response = await fetch(`${origin}/join?session=abc&map=The%20Sunken%20Crypt`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(`${origin}/?session=abc`); // the plain app, same session
      expect(response.headers.get('x-share-fallback')).toContain('answered 500');
    } finally {
      pageStatus = 200;
    }
  });
});
