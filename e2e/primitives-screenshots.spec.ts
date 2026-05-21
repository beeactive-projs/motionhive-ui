import { test } from '@playwright/test';
import * as path from 'path';

/**
 * Screenshot the /__primitives debug route at mobile + desktop widths
 * so we can visually verify each primitive in isolation before wiring
 * them into real surfaces.
 *
 * No auth seed — the route is public.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'primitives-mobile' },
  desktop: { width: 1440, height: 900, slug: 'primitives-desktop' },
} as const;

test.setTimeout(120_000);

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`primitives · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('debug route', async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);
      const snap = async (label: string) => {
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(outDir, `${label}.png`),
          fullPage: true,
        });
        console.log(`[${name}] snap → ${label}`);
      };

      await page.goto('/__primitives');
      await page.waitForSelector('h1:has-text("Primitives")', {
        timeout: 15_000,
      });
      await snap('01-overview');

      // Open the filter sheet and snap
      const filterBtn = page
        .locator('button:has-text("Open filter sheet")')
        .first();
      await filterBtn.click();
      await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
      await snap('02-filter-sheet');

      // Close
      await page.locator('.mh-bs__close').click().catch(() => {});
      await page.waitForTimeout(300);

      // Open the action sheet
      const actionBtn = page
        .locator('button:has-text("Open action sheet")')
        .first();
      await actionBtn.click();
      await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
      await snap('03-action-sheet');
    });
  });
}
