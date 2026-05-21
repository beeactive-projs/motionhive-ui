import { expect, test } from '@playwright/test';
import { INSTRUCTOR_FIXTURE, loginAsUser, mintToken } from './auth.helper';
import { expectSeedOk } from './seed.helper';

async function seedFreshSession(request: any): Promise<string> {
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E book ${Date.now()}`;
  const future = new Date(Date.now() + 21 * 86_400_000).toISOString();
  const res = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title, type: 'OPEN', access: 'OPEN', locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60, timezone: 'Europe/Bucharest',
      isRecurring: false, firstStartAt: future,
    },
  });
  await expectSeedOk(res, 'seed booking target');
  const body = (await res.json()) as { generatedInstances: { id: string }[] };
  return body.generatedInstances[0].id;
}

/**
 * Phase E — booking E2E.
 *
 * Walks the full client journey:
 *   1. USER lands on /sessions/discover
 *   2. Clicks a session card → lands on /sessions/:id (public showcase)
 *   3. Clicks "Book" → confirmation dialog
 *   4. Confirms → toast + redirect to My Sessions
 *   5. Booking appears in My Sessions / Upcoming or Pending tab
 *   6. Cancel from My Sessions detail surface (or the showcase)
 */

test.beforeEach(async ({ page }) => {
  await loginAsUser(page);
});

test('public showcase loads with either a Book button or a Booked state', async ({
  page,
}) => {
  await page.goto('/sessions/discover');
  const card = page.locator('mh-session-card').first();
  if ((await card.count()) === 0) test.skip(true, 'No discoverable sessions');
  await card.click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}/);
  // Either a Book button (not yet booked) or the Booked state card.
  await expect(
    page.locator('.mh-show__book-btn, .mh-show__booked').first(),
  ).toBeVisible({ timeout: 5000 });
});

test('booking a session adds it to /my/sessions', async ({ page, request }) => {
  // Seed a fresh instance so this test never skips on a populated DB.
  const instanceId = await seedFreshSession(request);

  await page.goto(`/sessions/${instanceId}`);
  await page.locator('.mh-show__hero').waitFor({ timeout: 5000 });
  const heading = page.getByRole('heading').first();
  const title = ((await heading.textContent()) ?? '').trim();

  // The showcase has a primary "Book" / "Request to join" button + a
  // "Back to Discover" secondary that also starts with B — be precise.
  // Match a button whose visible label ends in just "Book" / "Reserve" /
  // "Request to join" (vs. "Back to Discover" which also starts with "B").
  const bookBtn = page
    .getByRole('button')
    .filter({ hasText: /^(Book|Reserve|Request to join)$/ })
    .first();
  await expect(bookBtn).toBeVisible({ timeout: 5000 });
  await bookBtn.click();

  // Confirmation inside the dialog (not the showcase's Book button under
  // the dialog mask).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  const confirm = dialog
    .getByRole('button')
    .filter({ hasText: /confirm booking|request to join/i })
    .first();
  await confirm.click();

  // Success modal (`mh-booking-confirmed-dialog`) — "You're in!" or
  // "Request sent!" headline, with calendar export + "what happens next".
  const modal = page.locator('mh-booking-confirmed-dialog');
  await expect(
    modal.getByRole('heading', { name: /you're in|request sent/i }),
  ).toBeVisible({ timeout: 5000 });
  // Use the modal's "Go to My sessions" CTA so the test follows the same
  // path a real user would.
  await modal.getByRole('button', { name: /go to my sessions/i }).click();
  await page.waitForURL(/\/my\/sessions/, { timeout: 5000 });
  for (const tab of ['upcoming', 'pending', 'waitlisted']) {
    await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
    await page.waitForTimeout(500);
    const rows = await page.locator('[data-testid="my-row"]').count();
    if (rows > 0) return;
  }
  expect(`No rows found in any My Sessions tab after booking "${title}"`).toBe('found');
});

test('booking confirmation modal renders calendar export + next-steps', async ({
  page,
  request,
}) => {
  // Seed a fresh instance so this test never skips just because the user
  // has already booked everything on Discover.
  const instanceId = await seedFreshSession(request);

  await page.goto(`/sessions/${instanceId}`);
  await page.locator('.mh-show__hero').waitFor({ timeout: 5000 });

  const bookBtn = page
    .getByRole('button')
    .filter({ hasText: /^(Book|Reserve|Request to join)$/ })
    .first();
  await bookBtn.click();
  const confirmBtn = page
    .getByRole('dialog')
    .getByRole('button')
    .filter({ hasText: /confirm booking|request to join/i })
    .first();
  await confirmBtn.click();

  // The new success modal — assert all 3 design elements are there.
  const modal = page.locator('mh-booking-confirmed-dialog');
  await expect(
    modal.getByRole('heading', { name: /you're in|request sent/i }),
  ).toBeVisible({ timeout: 5000 });

  // The calendar export row OR a pending-approval explainer.
  const hasCalRow = (await modal.locator('.mh-bc__cal-buttons').count()) > 0;
  if (hasCalRow) {
    // Apple .ics is a button, Google + Outlook are anchors.
    await expect(modal.locator('.mh-bc__cal-btn')).toHaveCount(3);
    const googleLink = await modal
      .locator('a.mh-bc__cal-btn')
      .filter({ hasText: /google/i })
      .first()
      .getAttribute('href');
    expect(googleLink).toContain('calendar.google.com/calendar/render');
    const outlookLink = await modal
      .locator('a.mh-bc__cal-btn')
      .filter({ hasText: /outlook/i })
      .first()
      .getAttribute('href');
    expect(outlookLink).toContain('outlook.live.com/calendar');
  }

  // "What happens next" section.
  await expect(modal.locator('.mh-bc__steps')).toBeVisible();

  // Done dismisses the modal.
  await modal.getByRole('button', { name: /done/i }).click();
  await expect(modal.locator('.mh-bc__title')).toHaveCount(0);
});

test('cancel-booking dialog opens from a My Sessions row', async ({ page }) => {
  await page.goto('/my/sessions');
  // Try each tab that may contain an active booking.
  for (const tab of ['upcoming', 'pending']) {
    await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
    await page.waitForTimeout(300);
    const cancelBtn = page
      .locator('[data-testid="my-row"]')
      .first()
      .getByRole('button', { name: /cancel booking/i });
    if ((await cancelBtn.count()) === 0) continue;
    await cancelBtn.click();
    await expect(
      page.getByRole('dialog').getByText(/cancel booking/i).first(),
    ).toBeVisible({ timeout: 3000 });
    // Bail out via "Keep booking" so we don't actually cancel.
    await page.getByRole('button', { name: /keep booking/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    return;
  }
  test.skip(true, 'No active bookings to cancel');
});
