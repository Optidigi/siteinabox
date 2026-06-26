import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

const SITE_URL = process.env.SITE_URL ?? 'https://renderer.example.test';

export default defineConfig({
  site: SITE_URL,
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  build: {
    inlineStylesheets: 'auto',
  },
});
