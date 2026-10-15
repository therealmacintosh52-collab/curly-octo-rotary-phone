import { defineConfig } from '@playwright/test';

// E2E runs against the PRODUCTION build in MOCK mode (no keys; scripts/e2e-server.mjs strips any integration env).
// Chromium: Playwright's own browser from PLAYWRIGHT_BROWSERS_PATH (this sandbox: /opt/pw-browsers). Never run `playwright install` here.
// Set CHROME_PATH to use a specific binary instead.
const PORT = Number(process.env.E2E_PORT || 3210);
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One worker: the mock database and the in-memory rate limiters are process-wide singletons in the server under test.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs --port=${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
