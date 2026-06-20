import { test } from '@playwright/test';
import * as path from 'path';
import { INSTRUCTOR_FIXTURE, loginAs } from './auth.helper';

/**
 * Home page probe — full-page capture in light + dark to check that every
 * panel/card adapts to the theme. Run with: npx playwright test home-probe
 */

test.setTimeout(120_000);
const OUT = path.join(__dirname, '__screenshots__', 'home');

for (const theme of ['light', 'dark'] as const) {
  test.describe(`home · ${theme}`, () => {
    test.use({ viewport: { width: 1280, height: 1100 } });

    test(`full page`, async ({ page }) => {
      if (theme === 'dark') {
        await page.addInitScript(() => localStorage.setItem('mh-active-theme', 'dark'));
      }
      await loginAs(page, INSTRUCTOR_FIXTURE);
      await page.goto('/home');
      await page.waitForSelector('.hp-hero', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `${theme}-home.png`), fullPage: true });

      // Discover — the reference for card/surface styling on dark.
      await page.goto('/discover');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `${theme}-discover.png`), fullPage: true });
    });
  });
}
