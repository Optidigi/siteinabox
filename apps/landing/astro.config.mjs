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
    '/beheer': {
      status: 301,
      destination: 'https://admin.siteinabox.nl/login',
    },
    '/beheer/': {
      status: 301,
      destination: 'https://admin.siteinabox.nl/login',
    },
    '/intake': {
      status: 301,
      destination: 'https://admin.siteinabox.nl/login?intent=register',
    },
    '/intake/': {
      status: 301,
      destination: 'https://admin.siteinabox.nl/login?intent=register',
    },
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
