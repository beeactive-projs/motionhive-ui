import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Visual survey at two viewports. Runs the same flow twice and dumps
 * PNGs into `e2e/__screenshots__/mobile-survey/` (mobile) and
 * `e2e/__screenshots__/desktop-survey/` (desktop) so we can diff
 * desktop while iterating on mobile.
 *
 * Run with: npx playwright test mobile-screenshots
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

test.setTimeout(180_000);

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`viewport · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`survey — sessions surfaces`, async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);

      async function snap(label: string) {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(800).catch(() => {});
        await page.screenshot({
          path: path.join(outDir, `${label}.png`),
          fullPage: true,
        });
        console.log(`[${name}] snap →`, label);
      }

      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);

      // Sessions list
      await page.goto('/coaching/sessions');
      await page.waitForSelector('mh-page-shell', { timeout: 15_000 });
      await snap('01-sessions-list');

      // Calendar
      await page.goto('/coaching/sessions/calendar');
      await page.waitForSelector('mh-page-shell', { timeout: 15_000 });
      await snap('02-calendar-day');

      const weekBtn = page.locator('button:has-text("Week")').first();
      if (await weekBtn.isVisible().catch(() => false)) {
        await weekBtn.click();
        await snap('02b-calendar-week');
      }
      const monthBtn = page.locator('button:has-text("Month")').first();
      if (await monthBtn.isVisible().catch(() => false)) {
        await monthBtn.click();
        await snap('02c-calendar-month');
      }

      // Create session form
      await page.goto('/coaching/sessions');
      await page.waitForSelector('mh-page-shell', { timeout: 15_000 });
      const fab = page.locator('.mh-sessions__fab');
      const headerNew = page.locator('button:has-text("New session")').first();
      const opener = (await fab.isVisible().catch(() => false))
        ? fab
        : (await headerNew.isVisible().catch(() => false))
          ? headerNew
          : null;
      if (opener) {
        await opener.click();
        await page.waitForSelector('.mh-sf__body', { timeout: 5_000 }).catch(() => {});
        await snap('03-session-form-open');
      }

      // Pick an instance with confirmed participants
      const apiToken = await page.evaluate(() =>
        localStorage.getItem('motionhive_access_token'),
      );
      const res = await page.request.get(
        'http://localhost:3800/sessions/instances?limit=20',
        { headers: { Authorization: `Bearer ${apiToken}` } },
      ).catch(() => null);
      let instanceId: string | null = null;
      if (res && res.ok()) {
        const body: any = await res.json().catch(() => ({}));
        const items = body.items ?? body.data ?? [];
        const withPpl = items.find((i: any) => (i.confirmedCount ?? 0) > 0);
        instanceId = (withPpl ?? items[0])?.id ?? null;
      }
      if (instanceId) {
        await page.goto(`/coaching/sessions/${instanceId}`);
        await snap('04-session-instance-detail');
      }
    });
  });
}
