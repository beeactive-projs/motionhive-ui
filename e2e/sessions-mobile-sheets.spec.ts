import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Mobile-only — verify the 1B filter sheet + 1C action sheet open and
 * are usable. Functional + visual.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(60_000);

const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

async function snap(page: any, label: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: false });
}

test('mobile · filter sheet opens, applies, dismisses', async ({ page }) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('.mh-mob__pill--filters', { timeout: 10_000 });

  // Open
  await page.locator('.mh-mob__pill--filters').click();
  await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
  await snap(page, '05-filter-sheet-open');

  // Tap a Type pill inside the sheet to apply a filter
  await page.locator('.mh-bs__sheet').getByText('Group', { exact: true }).click();
  await page.waitForTimeout(300);
  await snap(page, '05b-filter-sheet-group-active');

  // Apply (closes sheet)
  await page.locator('.mh-bs__sheet').getByRole('button', { name: /Apply/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.mh-bs__sheet')).toHaveCount(0);
  await snap(page, '05c-filter-sheet-dismissed');
});

test('mobile · long-press a row opens action sheet', async ({ page }) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('mh-time-row', { timeout: 10_000 });

  // Right-click is the desktop equivalent of long-press; the
  // (contextmenu) handler in the template fires for both.
  const firstRow = page.locator('mh-time-row').first();
  await firstRow.click({ button: 'right' });
  await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
  await snap(page, '06-action-sheet-open');

  // Tap "Cancel session…" — sheet should dismiss (no destructive
  // effect for now; just verify the row handler closes the sheet).
  await page.locator('.mh-bs__sheet').getByText(/Cancel session/).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.mh-bs__sheet')).toHaveCount(0);
});
