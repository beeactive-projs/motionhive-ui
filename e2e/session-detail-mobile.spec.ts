import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Mobile session-detail (frames 3A/3B/3C) interactions.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(60_000);

const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

async function snap(page: any, label: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });
}

async function pickInstanceId(page: any): Promise<string | null> {
  const apiToken = await page.evaluate(() =>
    localStorage.getItem('motionhive_access_token'),
  );
  // SCHEDULED instances start ASC; the first is the soonest future one.
  // The session-detail action sheet only renders "Edit session" when
  // the instance is SCHEDULED — past/completed/cancelled show only
  // "Open calendar". Force SCHEDULED so the test exercises the full
  // verb set.
  const now = new Date().toISOString();
  const res = await page.request
    .get(`http://localhost:3800/sessions/instances?limit=20&status=SCHEDULED&dateFrom=${encodeURIComponent(now)}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    .catch(() => null);
  if (!res || !res.ok()) return null;
  const body: any = await res.json().catch(() => ({}));
  const items = body.items ?? body.data ?? [];
  const withPpl = items.find((i: any) => (i.confirmedCount ?? 0) > 0);
  return (withPpl ?? items[0])?.id ?? null;
}

test('mobile · session-detail action sheet opens from ⋮', async ({ page }) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('mh-time-row', { timeout: 10_000 });
  const instanceId = await pickInstanceId(page);
  test.skip(!instanceId, 'no session instances seeded');

  await page.goto(`/coaching/sessions/${instanceId}`);
  await page.waitForSelector('mh-participants-table', { timeout: 10_000 });
  await snap(page, '07-detail-mobile-loaded');

  // Tap the ⋮ overflow button in the header
  const overflowBtn = page.getByRole('button', { name: 'More actions' });
  await overflowBtn.click();
  await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
  await snap(page, '07b-detail-mobile-actions-open');

  // Sheet should contain the instructor verbs.
  const sheet = page.locator('.mh-bs__sheet');
  await expect(sheet.getByText(/Edit session/)).toBeVisible();
  await expect(sheet.getByText(/Cancel session/)).toBeVisible();

  // Tap "Edit session" — action sheet should dismiss + edit sheet should
  // open. On mobile the create/edit form is a <mh-bottom-sheet>, not a
  // <p-dialog>; we assert the new sheet is showing the "Edit session"
  // title (the basics section is the body).
  await sheet.getByText('Edit session').click();
  await page.waitForTimeout(800);
  // The previous (action) sheet should have closed; the new (edit) sheet
  // is the only .mh-bs__sheet on screen and carries the "Edit session"
  // header.
  await expect(
    page.locator('.mh-bs__sheet:has-text("Edit session")'),
  ).toBeVisible({ timeout: 5_000 });
  await snap(page, '07c-detail-mobile-edit-sheet');
});
