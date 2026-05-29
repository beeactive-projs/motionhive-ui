import { expect, test } from '@playwright/test';
import { loginAsUser } from './auth.helper';

/**
 * Regression for the broken notification deep-link the user hit:
 * clicking a SESSION_CANCEL notification fired the URL `/sessions/my`,
 * which fell through to the public showcase `/sessions/:id` with id='my'
 * and triggered `GET /sessions/instances/my/public` → 400.
 */

test.beforeEach(async ({ page }) => {
  await loginAsUser(page);
});

test('/sessions/my redirects to /my/sessions (no 400 from showcase)', async ({
  page,
}) => {
  const blockingErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') blockingErrors.push(msg.text());
  });
  await page.goto('/sessions/my');
  await expect(page).toHaveURL(/\/my\/sessions$/);
  // Make sure the page actually rendered.
  await expect(
    page.getByRole('heading', { name: /my sessions/i }),
  ).toBeVisible({ timeout: 5000 });
  // No "Validation failed" 400 in console.
  const blocking = blockingErrors.filter(
    (e) =>
      !e.includes('NG0913') && !e.includes('preloaded using link preload'),
  );
  expect(blocking.join('\n')).not.toMatch(/Validation failed|uuid is expected/i);
});

test('non-UUID session id renders a friendly error, not a BE 400', async ({
  page,
}) => {
  const blockingErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') blockingErrors.push(msg.text());
  });
  await page.goto('/sessions/not-a-uuid');
  await expect(page.getByText(/that session link looks invalid/i)).toBeVisible({
    timeout: 5000,
  });
  expect(blockingErrors.join('\n')).not.toMatch(/Validation failed|uuid is expected/i);
});
