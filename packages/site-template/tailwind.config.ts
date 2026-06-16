import type { Config } from 'tailwindcss';

// Tailwind 4 reads color values from @theme in src/styles/global.css at build time —
// that file is the source of truth. The colors below exist only for editor tooling
// (autocomplete in class strings). Keep them in sync with global.css.
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0ea5e9',
          fg: '#ffffff',
        },
        accent: {
          DEFAULT: '#f59e0b',
          fg: '#000000',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
