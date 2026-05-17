import { expect, test } from '@playwright/test';
import { INSTRUCTOR_FIXTURE, loginAsInstructor, mintToken } from './auth.helper';
import { expectSeedOk } from './seed.helper';

/**
 * Cancel a session end-to-end via the instructor detail page.
 * Seeds its own one-off so the test isn't sensitive to existing DB state.
 */

test('instructor can cancel a session end-to-end', async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E cancel ${Date.now()}`;
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const seeded = await request.post('http://localhost:3800/sessions/templates', {
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
  await expectSeedOk(seeded, 'seed one-off');

  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.getByPlaceholder(/search sessions/i).fill(title);
  await page.waitForTimeout(400);
  const card = page.locator('mh-session-card', { hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  await page.waitForURL(/\/coaching\/sessions\/[0-9a-f-]{36}$/, { timeout: 5000 });

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

  // Success toast — proves the dialog fired the API call and got 2xx.
  await expect(
    page.locator('p-toast').getByText(/session cancelled/i),
  ).toBeVisible({ timeout: 5000 });

  await expect(page.getByRole('dialog')).toHaveCount(0);

  const blocking = consoleErrors.filter(
    (e) =>
      !e.includes('NG0913') &&
      !e.includes('preloaded using link preload') &&
      !e.includes('quill-delta'),
  );
  if (blocking.length > 0)
    console.error('Console errors:\n' + blocking.join('\n---\n'));
  expect(blocking).toEqual([]);
});
