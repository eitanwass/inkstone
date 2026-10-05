import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { resolveSiteUrl } from './scripts/site-url';

export default defineConfig({
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
  ],
});
