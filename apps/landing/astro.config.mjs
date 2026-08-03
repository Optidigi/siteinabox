import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  redirects: {
    '/privacy-policy': '/privacy-en-cookieverklaring',
  },
  integrations: [
    sitemap({
      filter: (page) => new URL(page).pathname !== '/beheer/',
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
