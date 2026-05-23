import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsUser } from './auth.helper';

/**
 * Smoke screenshot the user-facing My Sessions page at both viewports
 * after the filter UI alignment with the instructor list. No real
 * assertions — purely visual.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

test.setTimeout(60_000);

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`my-sessions · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('filters surface renders', async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);

      await loginAsUser(page);
      await page.goto('/sessions/my');
      await page.waitForSelector('.mh-my__filters', { timeout: 10_000 });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(outDir, '09-my-sessions.png'),
        fullPage: true,
      });
      console.log(`[${name}] snap → 09-my-sessions`);
    });
  });
}
