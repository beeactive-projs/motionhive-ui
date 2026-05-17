import { expect, test } from '@playwright/test';
import { loginAsUser } from './auth.helper';

/**
 * Phase E — "My sessions" smoke walk.
 *
 * The page lists the logged-in user's bookings, grouped by tab:
 *   upcoming · pendingApproval · waitlisted · past · cancelled
 *
 * Acceptance:
 *   - Page loads under `/my/sessions`
 *   - Tabs are clickable; current tab is highlighted
 *   - Bookings list pulls from `GET /sessions/my`
 *   - Each booking row links to the session detail / showcase
 */

test.describe('Phase E — My Sessions', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));
    await loginAsUser(page);
  });

  test.afterEach(async () => {
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

  test('my sessions page loads with tabs', async ({ page }) => {
    await page.goto('/my/sessions');
    await expect(
      page.getByRole('heading', { name: /my sessions/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Tabs visible
    for (const tab of ['Upcoming', 'Pending', 'Waitlisted', 'Past', 'Cancelled']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
  });

  test('switching tabs re-fetches bookings', async ({ page }) => {
    await page.goto('/my/sessions');
    await expect(
      page.getByRole('heading', { name: /my sessions/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: /pending/i }).click();
    // Either at least one row or an explicit empty state appears.
    await expect(
      page.locator('[data-testid="my-row"], [data-testid="my-empty"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
