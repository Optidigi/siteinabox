import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4399',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.SIAB_REUSE_LANDING_BUILD === '1'
      ? 'pnpm preview --host 127.0.0.1 --port 4399'
      : 'pnpm build && pnpm preview --host 127.0.0.1 --port 4399',
    env: {
      ...process.env,
      // Astro 7 backgrounds preview servers when it detects an agent. Playwright
      // needs the preview process to remain in the foreground.
      ASTRO_PREVIEW_BACKGROUND: '0',
      PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
