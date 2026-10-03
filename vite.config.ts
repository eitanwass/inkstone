import { defineConfig } from 'vite';

// The address the site is served from, for the link-preview tags in index.html:
// chat apps need an absolute URL for the preview image. SITE_URL overrides;
// otherwise Vercel's production domain (set during its builds); otherwise empty,
// which leaves the URLs relative (fine for local development).
function siteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return '';
}

export default defineConfig({
  plugins: [
    {
      name: 'inkstone-site-url',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('%SITE_URL%', siteUrl()),
      },
    },
  ],
});
