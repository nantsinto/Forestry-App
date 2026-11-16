import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the timber passport flow.
 *
 * Locally: `npm run test:e2e` starts the Vite dev server itself (or reuses one on
 * port 3000). In the sandbox stack, point PLAYWRIGHT_BASE_URL at the running web
 * service and the tests run against it without spawning another server.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // The PWA service worker can serve stale bundles; tests must see live source.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
