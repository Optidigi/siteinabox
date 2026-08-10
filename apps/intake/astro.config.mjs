import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  base: '/intake',
  output: 'static',
  devToolbar: {
    enabled: false,
  },
  integrations: [
    sitemap(),
    react({
      include: ['**/components/intake/**/*.tsx', '**/components/ui/**/*.tsx'],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
