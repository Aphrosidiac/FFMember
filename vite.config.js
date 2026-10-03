import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const page = (p) => resolve(root, p);

// `<!-- @include name -->` pulls partials/name.html into every page, so the nav, footer and
// dialogs have one source. `<!-- @include name current=studio -->` marks a nav link as current.
const includes = {
  name: 'ff-includes',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace(/<!--\s*@include\s+([\w-]+)((?:\s+\w+=[\w/-]+)*)\s*-->/g, (_, name, args) => {
        let part = readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8');
        const current = args.match(/current=([\w-]+)/)?.[1];
        part = part.replace(/\{\{cur:([\w-]+)\}\}/g, (_, k) => (k === current ? ' is-current' : ''));
        part = part.replace(/\{\{aria:([\w-]+)\}\}/g, (_, k) => (k === current ? ' aria-current="page"' : ''));
        return part;
      });
    },
  },
};

export default defineConfig({
  plugins: [includes],
  server: { port: 3180, strictPort: true },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        home: page('index.html'),
        studio: page('studio/index.html'),
        terms: page('legal/terms/index.html'),
        privacy: page('legal/privacy/index.html'),
        notFound: page('404.html'),
      },
    },
  },
});
