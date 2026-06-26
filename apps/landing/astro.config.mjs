import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [
    sitemap(),
    // Preact scoped to cms/ and preview/ dirs only. compat:false avoids
    // pulling React-compat shims; include glob ensures Astro treats only
    // these files as Preact components.
    preact({
      compat: false,
      include: ['**/components/cms/**', '**/components/preview/**'],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
