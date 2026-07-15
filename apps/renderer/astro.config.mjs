import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://renderer.example.test';

export default defineConfig({
  integrations: [react()],
  site: SITE_URL,
  output: 'server',
  security: {
    // Renderer hosts are dynamic tenant domains; form ingress validates the
    // active tenant by Host before forwarding to CMS, so Astro's static
    // site-origin CSRF check would reject legitimate tenant POSTs.
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  vite: {
    cacheDir: process.env.SIAB_VITE_CACHE_DIR,
    // The provider parity client reaches this dependency through the linked
    // site-renderer workspace. Pre-bundle it before the first browser request
    // so Vite never invalidates that request with "Outdated Optimize Dep".
    optimizeDeps: { include: ['@number-flow/react'] },
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
