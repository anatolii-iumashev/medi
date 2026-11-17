import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321/medi/',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'BASE_PATH=/medi/ SITE_URL=https://example.github.io npm run build && node tests/e2e/static-server.mjs /medi/',
    url: 'http://127.0.0.1:4321/medi/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
