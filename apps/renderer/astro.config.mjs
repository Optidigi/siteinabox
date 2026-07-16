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
    // The provider parity client reaches these dependencies through linked
    // workspaces and the shared site behavior entry. Pre-bundle them before
    // the first browser request so Vite cannot invalidate an in-flight catalog
    // check when it discovers the analytics or animated-number imports.
    optimizeDeps: { include: ['@number-flow/react', 'posthog-js', 'web-vitals'] },
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
