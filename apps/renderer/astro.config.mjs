import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://renderer.example.test';
const DEV_ALLOWED_HOSTS = (process.env.SIAB_RENDERER_DEV_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

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
  server: {
    allowedHosts: DEV_ALLOWED_HOSTS,
  },
  vite: {
    cacheDir: process.env.SIAB_VITE_CACHE_DIR,
    // Shared workspace packages declare React as a peer. Always resolve that
    // peer from this application so SSR and hydrated dependencies cannot load
    // a second React instance from another workspace consumer.
    resolve: { dedupe: ['react', 'react-dom'] },
    // The SSR entry validates snapshots through the linked contracts package.
    // Pre-bundle that first-party graph before a browser smoke request so Vite
    // cannot discover zod after serving the page and invalidate the lifecycle.
    optimizeDeps: { include: ['@siteinabox/contracts', 'posthog-js'] },
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
