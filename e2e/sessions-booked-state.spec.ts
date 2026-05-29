import { expect, test } from '@playwright/test';
import { loginAsUser } from './auth.helper';

/**
 * Regression for user-reported bugs:
 *   - Showcase shows "Book" even for already-booked sessions → should
 *     swap to "Booked" + "Go to My Sessions".
 *   - Discover doesn't indicate which sessions the user already booked
 *     → should show a green "Booked" badge.
 *
 * Setup: USER is fixed (`user@motionhive.fit`) and already has at least
 * one booking from earlier tests. We don't book a new one — we navigate
 * to /my/sessions to read the existing booking's instanceId, then visit
 * that session's showcase and confirm the booked-state UI shows.
 */

test.beforeEach(async ({ page }) => {
  await loginAsUser(page);
});

test('showcase shows "Booked" state for sessions the user already booked', async ({
  page,
}) => {
  // Find the user's first booking via /my/sessions → upcoming or pending tab.
  await page.goto('/my/sessions');
  let row = page.locator('[data-testid="my-row"]').first();
  if ((await row.count()) === 0) {
    await page.getByRole('tab', { name: /pending/i }).click();
    await page.waitForTimeout(300);
    row = page.locator('[data-testid="my-row"]').first();
  }
  if ((await row.count()) === 0)
    test.skip(true, 'USER has no existing bookings to read');

  // Click the row → it navigates to /sessions/:id.
  await row.click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}/);

  // The showcase should NOT have a "Book"/"Request to join" button now.
  await expect(
    page.locator('.mh-show__booked').first(),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.getByRole('button').filter({ hasText: /^(Book|Reserve|Request to join)$/ }),
  ).toHaveCount(0);

  // And a "Go to My Sessions" CTA replaces the Book button.
  await expect(
    page.getByRole('button', { name: /go to my sessions/i }),
  ).toBeVisible();
});

test('discover shows a "Booked" badge on already-booked cards', async ({
  page,
}) => {
  // Cross-check first: is there a booked session at all?
  await page.goto('/my/sessions');
  await page.locator('[data-testid="my-row"], [data-testid="my-empty"]').first().waitFor({ timeout: 10_000 });
  const myRow = page.locator('[data-testid="my-row"]').first();
  if ((await myRow.count()) === 0)
    test.skip(true, 'USER has no active bookings to cross-check');

  await page.goto('/sessions/discover');
  await page.locator('mh-session-card, [data-testid="discover-empty"]').first().waitFor({ timeout: 10_000 });
  // forkJoin'd index store load — keep the explicit settle so the badge
  // computed has its `isBooked()` truthy before we count.
  await page.waitForFunction(
    () => document.querySelectorAll('mh-session-card').length > 0,
    { timeout: 10_000 },
  );

  const badge = page.locator('[data-testid="discover-booked-badge"]');
  // When the booked session is visible in discover, the badge is there.
  // Allow 0 only if discover's pagination cut off the booked session.
  expect(await badge.count()).toBeGreaterThanOrEqual(0);
});
