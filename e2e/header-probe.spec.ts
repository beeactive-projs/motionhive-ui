import { test } from '@playwright/test';
import * as path from 'path';
import { USER_FIXTURE, loginAs } from './auth.helper';

/**
 * Header probe: hexagon profile avatar in the nav bar + the notification
 * panel's unread treatment. The USER fixture has unread notifications.
 * Run with: npx playwright test header-probe
 */

test.setTimeout(120_000);
test.use({ viewport: { width: 1280, height: 1400 } });

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} header avatar + notifications`, async ({ page }) => {
    if (theme === 'dark') {
      await page.addInitScript(() => localStorage.setItem('mh-active-theme', 'dark'));
    }
    const OUT = path.join(__dirname, '__screenshots__', 'header', theme);
    await loginAs(page, USER_FIXTURE);
    await page.goto('/home');
    await page.waitForSelector('mh-profile-menu', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Toolbar (hex avatar + bell).
    const toolbar = page.locator('p-toolbar').first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.screenshot({ path: path.join(OUT, '01-toolbar.png') });
    }

    // Open notifications.
    const bell = page.getByRole('button', { name: 'Open notifications' }).first();
    if (await bell.isVisible().catch(() => false)) {
      await bell.click();
      await page.waitForSelector('.notification-popover', { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const pop = page.locator('.notification-popover').first();
      if (await pop.isVisible().catch(() => false)) {
        await pop.screenshot({ path: path.join(OUT, '02-notifications.png') });
      } else {
        await page.screenshot({ path: path.join(OUT, '02-notifications.png') });
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Open profile menu (hex avatar inside).
    const profileBtn = page.getByRole('button', { name: /Open profile menu/ }).first();
    if (await profileBtn.isVisible().catch(() => false)) {
      await profileBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, '03-profile-menu.png') });
    }
  });
}
