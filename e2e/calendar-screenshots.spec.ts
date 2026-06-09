import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Section 2 — Calendar visual + interaction survey at both viewports.
 *
 * Mobile flow:
 *   1. Default Agenda view (frame 2A) — week strip + filter pills +
 *      day-grouped agenda below.
 *   2. Toggle to Day mode (frame 2B) — the grid renders single-column.
 *   3. Tap "May 2026 ▾" — month sheet opens (frame 2C).
 *
 * Desktop flow: same page, ensure the desktop layout (rail + grid)
 * still renders unchanged.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

test.setTimeout(60_000);

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`calendar · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('renders + interactions', async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);
      const snap = async (label: string) => {
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(outDir, `${label}.png`),
          fullPage: true,
        });
        console.log(`[${name}] snap → ${label}`);
      };

      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
      await page.goto('/coaching/sessions/calendar');
      await page.waitForSelector('header', { timeout: 15_000 });
      await page.waitForTimeout(800);
      await snap('10-calendar-default');

      if (name === 'mobile') {
        // Mobile defaults to Agenda mode — week strip should be visible.
        await expect(page.locator('mh-week-strip')).toBeVisible();
        await snap('10-calendar-agenda');

        // Toggle to Day mode
        const dayBtn = page.locator('.mh-mob-cal__view-btn:has-text("Day")');
        if (await dayBtn.isVisible().catch(() => false)) {
          await dayBtn.click();
          await page.waitForTimeout(500);
          await snap('10b-calendar-day-zoom');
          // Back to Agenda
          await page.locator('.mh-mob-cal__view-btn:has-text("Agenda")').click();
          await page.waitForTimeout(500);
        }

        // Open the month sheet
        const monthTrigger = page.locator('.mh-mob-cal__month-trigger');
        if (await monthTrigger.isVisible().catch(() => false)) {
          await monthTrigger.click();
          await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
          await snap('10c-calendar-month-sheet');
        }
      } else {
        // Desktop should still show the mini-month + filters rail.
        await expect(page.locator('.mh-cal__rail')).toBeVisible();
        await expect(page.locator('mh-calendar-grid')).toBeVisible();
      }
    });
  });
}
