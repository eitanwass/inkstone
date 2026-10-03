import { defineConfig } from 'vite';
import { resolveSiteUrl } from './scripts/site-url';

export default defineConfig({
  plugins: [
    {
      // Fills in the %SITE_URL% placeholder in index.html's link-preview tags.
      name: 'inkstone-site-url',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('%SITE_URL%', resolveSiteUrl(process.env)),
      },
    },
  ],
});
