import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { analyticsTags, resolveAnalyticsToken } from './scripts/analytics';
import { resolveSiteUrl } from './scripts/site-url';

export default defineConfig({
  // Preact for the parts of the UI written as components (src/ui/library.tsx): Vite's own JSX handling is enough.
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  // Four pages: the home page (index.html), the editor (draw/index.html), the docs (docs/index.html) and contact.
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        draw: 'draw/index.html',
        docs: 'docs/index.html',
        contact: 'contact/index.html',
      },
    },
  },
  plugins: [
    {
      // Pastes html/*.html into index.html wherever it has `<!-- @include html/name.html -->`, so the page
      // is edited in small files. Editing one reloads the page.
      name: 'inkstone-html-include',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html.replace(/^[ \t]*<!--\s*@include\s+(\S+)\s*-->[ \t]*$/gm, (_, file) =>
            readFileSync(file, 'utf8').trimEnd(),
          ),
      },
      configureServer(server) {
        server.watcher.add('html');
        server.watcher.on('change', (file) => {
          if (/[\\/]html[\\/]/.test(file)) server.ws.send({ type: 'full-reload' });
        });
      },
    },
    {
      // Fills in the %SITE_URL% placeholder in index.html's link-preview tags.
      name: 'inkstone-site-url',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('%SITE_URL%', resolveSiteUrl(process.env)),
      },
    },
    {
      // The page-view counter (Cloudflare Web Analytics), in a production build that has a token only.
      // See scripts/analytics.ts.
      name: 'inkstone-analytics',
      apply: 'build',
      transformIndexHtml: () => analyticsTags(resolveAnalyticsToken(process.env)),
    },
  ],
});
