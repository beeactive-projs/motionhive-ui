import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for MotionHive e2e smoke tests.
 *
 * The tests **assume** that `ng serve` is already running on
 * http://localhost:4200 and that the API is up on http://localhost:3800.
 * Both are typically running during development, so we don't auto-start
 * them here — the test will fail fast with a clear error if they aren't.
 *
 * Run with: `npx playwright test`
 * Headed (visible browser) with: `npx playwright test --headed`
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — shared BE state
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
