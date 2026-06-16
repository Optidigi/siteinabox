// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ami-care.nl',
  trailingSlash: 'never',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // React handles the interactive shell (Nav, anything outside cms/preview).
  // Preact handles the cms block renderers and live-preview island.
  // Globs MUST NOT overlap — Astro will fail to compile a .tsx that two integrations claim.
  integrations: [
    react({ exclude: ['**/components/cms/**', '**/components/preview/**'] }),
    preact({ compat: false, include: ['**/components/cms/**', '**/components/preview/**'] }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
