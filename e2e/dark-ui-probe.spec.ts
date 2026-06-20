import { test } from '@playwright/test';
import * as path from 'path';
import { INSTRUCTOR_FIXTURE, loginAs } from './auth.helper';

/**
 * Dark-theme spot checks: the shared segmented control (sidebar Coach/Train,
 * messages All/Unread) and the global search modal (recent/trending/footer).
 * Run with: npx playwright test dark-ui-probe
 */

test.setTimeout(120_000);

test.use({ viewport: { width: 1280, height: 900 } });

for (const theme of ['light', 'dark'] as const) {
 test(`${theme} segmented + search modal`, async ({ page }) => {
  if (theme === 'dark') {
    await page.addInitScript(() => localStorage.setItem('mh-active-theme', 'dark'));
  }
  const OUT = path.join(__dirname, '__screenshots__', 'dark-ui', theme);
  await loginAs(page, INSTRUCTOR_FIXTURE);

  // Sidebar Coach/Train segmented (honey variant) — visible on home.
  await page.goto('/home');
  await page.waitForSelector('.mode-seg, mh-segmented', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const seg = page.locator('.mode-seg').first();
  if (await seg.isVisible().catch(() => false)) {
    await seg.screenshot({ path: path.join(OUT, '01-sidebar-coach-train.png') });
  }

  // Messages All/Unread segmented (neutral variant).
  await page.goto('/messages');
  await page.waitForSelector('mh-inbox-filters', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const filters = page.locator('mh-inbox-filters').first();
  if (await filters.isVisible().catch(() => false)) {
    await filters.screenshot({ path: path.join(OUT, '02-messages-filters.png') });
  }

  // Global search modal — open via the toolbar trigger.
  const trigger = page.locator('.search-trigger').first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  } else {
    await page.keyboard.press('Meta+k');
  }
  await page.waitForSelector('.search-modal', { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '03-search-modal.png') });
 });
}
