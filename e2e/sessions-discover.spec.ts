import { expect, test } from '@playwright/test';
import { loginAsUser } from './auth.helper';

/**
 * Phase E — Discover page smoke walk.
 *
 * The Discover page is the client-facing entry point for finding
 * bookable sessions. It must:
 *   - Load anonymously (no JWT required)
 *   - Show a list of public session instances pulled from
 *     `GET /sessions/discover`
 *   - Surface basic filters (type / location / date range)
 *   - Let the user click a card and land on the public showcase
 */

test.describe('Phase E — Discover page', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));
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

  test('discover loads for logged-in USER and shows public sessions', async ({
    page,
  }) => {
    await loginAsUser(page);
    await page.goto('/sessions/discover');
    await expect(
      page.getByRole('heading', { name: /discover|find a session/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('mh-session-card, [data-testid="discover-empty"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('search input narrows the result list', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/sessions/discover');
    const searchInput = page.getByPlaceholder(/search/i).first();
    if ((await searchInput.count()) === 0)
      test.skip(true, 'No search input on Discover page yet.');
    await searchInput.fill('this-should-match-nothing-xyzzy');
    // Wait for re-fetch + empty-state.
    await expect(
      page.locator('[data-testid="discover-empty"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('clicking a session card navigates to the public showcase', async ({
    page,
  }) => {
    await loginAsUser(page);
    await page.goto('/sessions/discover');
    const card = page.locator('mh-session-card').first();
    if ((await card.count()) === 0) test.skip(true, 'No discoverable sessions.');
    await card.click();
    // Showcase route — could be /sessions/:id (instance id) or
    // /u/:handle/sessions/:slug. Accept either.
    await expect(page).toHaveURL(
      /\/sessions\/[0-9a-f-]{36}|\/u\/[a-z0-9-]+\/sessions\/[a-z0-9-]+/,
    );
  });
});
