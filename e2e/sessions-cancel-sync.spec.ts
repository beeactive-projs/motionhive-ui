import { expect, test } from '@playwright/test';
import { INSTRUCTOR_FIXTURE, loginAsInstructor, mintToken } from './auth.helper';
import { expectSeedOk } from './seed.helper';

/**
 * User-reported bug: clicked Cancel on the session detail page, got a
 * success toast, but the session didn't move to the "Cancelled" tab in
 * the list. State sync failure.
 *
 * This test:
 *   1. Lands on /coaching/sessions
 *   2. Captures the instance id of the first non-template card
 *   3. Opens its detail, cancels it
 *   4. Goes back to the list and confirms it's NOT in the Upcoming tab
 *   5. Switches to Cancelled tab and confirms it IS there
 */

test.beforeEach(async ({ page }) => {
  await loginAsInstructor(page);
});

test('cancelled one-off session disappears from Upcoming tab', async ({
  page,
  request,
}) => {
  // Create a brand-new one-off via the API so the test owns its fixture
  // and isn't poisoned by past runs.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E cancel-sync ${Date.now()}`;
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const created = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: future,
    },
  });
  await expectSeedOk(created, 'seed one-off');

  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  // The dev DB has many templates; search by title so the card is on
  // the first page of results.
  await page.getByPlaceholder(/search sessions/i).fill(title);
  await page.waitForTimeout(400);
  const card = page.locator('mh-session-card', { hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  await page.waitForURL(
    /\/coaching\/sessions\/(templates\/)?[0-9a-f-]{36}/,
    { timeout: 5000 },
  );
  // One-off → routes to instance detail.
  expect(page.url()).not.toContain('/templates/');
  const cancelledTitle = title;

  // Open + submit the cancel dialog.
  await page
    .locator('[actions]')
    .getByRole('button', { name: /cancel/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/cancel session/i).first()).toBeVisible({
    timeout: 5000,
  });
  await dialog
    .getByRole('button')
    .filter({ hasText: /^cancel session$/i })
    .first()
    .click();
  // Success toast confirms the BE accepted it.
  await expect(
    page.locator('p-toast').getByText(/session cancelled/i),
  ).toBeVisible({ timeout: 5000 });

  // The detail page should reflect the new status (no more Cancel button
  // available, or status badge says Cancelled). We'll just go back to
  // the list and check the tab placement.
  await page.goto('/coaching/sessions');

  // The cancelled session should NOT be in Upcoming any more.
  await page.getByRole('tab', { name: /upcoming/i }).click();
  await page.waitForTimeout(800);
  const upcomingRow = page.locator('mh-session-card', { hasText: cancelledTitle });
  await expect(upcomingRow).toHaveCount(0);
});

test('cancelled instance appears in the Cancelled tab', async ({
  page,
  request,
}) => {
  // Seed + cancel a one-off so we know the Cancelled tab has something.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E cancelled-tab ${Date.now()}`;
  const created = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    },
  });
  await expectSeedOk(created, 'seed for cancelled-tab');
  const body = await created.json();
  const instanceId = body.generatedInstances?.[0]?.id;
  expect(instanceId).toBeTruthy();
  const cancelled = await request.post(
    `http://localhost:3800/sessions/instances/${instanceId}/cancel`,
    { headers: { Authorization: `Bearer ${token}` }, data: { scope: 'this' } },
  );
  await expectSeedOk(cancelled, 'cancel via API');

  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.getByRole('tab', { name: /cancelled/i }).click();
  await page.waitForTimeout(800);
  // Cancelled instances list shows ALL cancelled in the 90-day window.
  // Filter to this test's title.
  const card = page.locator('mh-session-card', { hasText: title });
  await expect(card.first()).toBeVisible({ timeout: 5000 });
});

test('cancel button is hidden on an already-cancelled instance', async ({
  page,
  request,
}) => {
  // Seed + immediately cancel via API, then load the detail page.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const created = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `E2E pre-cancelled ${Date.now()}`,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    },
  });
  await expectSeedOk(created, 'seed pre-cancelled');
  const body = await created.json();
  const instanceId = body.generatedInstances?.[0]?.id;
  expect(instanceId).toBeTruthy();
  // Cancel via API.
  const cancelled = await request.post(
    `http://localhost:3800/sessions/instances/${instanceId}/cancel`,
    { headers: { Authorization: `Bearer ${token}` }, data: { scope: 'this' } },
  );
  await expectSeedOk(cancelled, 'cancel pre-cancelled');

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/${instanceId}`);
  await page.locator('.mh-sd__hero').waitFor({ timeout: 5000 });

  // No Cancel button in actions — should show the status tag instead.
  const cancelBtn = page
    .locator('[actions]')
    .getByRole('button', { name: /^\s*cancel\s*$/i });
  await expect(cancelBtn).toHaveCount(0);
});
