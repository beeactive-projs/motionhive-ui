/**
 * End-to-end flow walk — captures a screenshot at every meaningful step
 * of the instructor + client journeys so they can be reviewed together.
 *
 * Output: `e2e/__screenshots__/flow-walk/<step>.png`
 *
 * Steps cover the muddy areas the user flagged:
 *   - One-off vs recurring distinction on the list
 *   - Template detail vs instance detail
 *   - Cancel flow (instructor + client)
 *   - Edit flow
 *   - Discover → Showcase → Book
 */
import { test, type Page } from '@playwright/test';
import {
  INSTRUCTOR_FIXTURE,
  loginAsInstructor,
  loginAsUser,
  mintToken,
} from './auth.helper';
import { expectSeedOk } from './seed.helper';
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.join(__dirname, '__screenshots__', 'flow-walk');

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

async function snap(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

test('instructor flow walk: list → one-off detail → cancel', async ({ page, request }) => {
  // Seed a clean one-off so this test owns its fixture.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `Flow walk one-off ${Date.now()}`;
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
      firstStartAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    },
  });
  await expectSeedOk(seeded);

  await loginAsInstructor(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Sessions list
  await page.goto('/coaching/sessions');
  // The dev DB has many templates from earlier test runs; use the search
  // input to filter down to our fresh fixture so the card is on screen.
  const search = page.getByPlaceholder(/search sessions/i);
  await search.waitFor({ timeout: 10_000 });
  await search.fill(title);
  const targetCard = page.locator('mh-session-card', { hasText: title }).first();
  await targetCard.waitFor({ timeout: 10_000 });
  await snap(page, '01-instructor-sessions-list');

  // 2. Click the one-off → instance detail
  await targetCard.click();
  await page.waitForURL(/\/coaching\/sessions\/[0-9a-f-]{36}/);
  await page.locator('.mh-sd__hero').waitFor({ timeout: 5000 });
  await snap(page, '02-instructor-instance-detail');

  // 3. Open Edit dialog
  await page.getByRole('button', { name: /edit/i }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  await snap(page, '03-instructor-edit-dialog');
  await page.getByRole('button', { name: /cancel/i }).last().click();
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });

  // 4. Open Cancel dialog
  await page
    .locator('[actions]')
    .getByRole('button', { name: /cancel/i })
    .first()
    .click();
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  await snap(page, '04-instructor-cancel-dialog');

  // 5. Submit cancel → success toast
  await page
    .getByRole('dialog')
    .getByRole('button')
    .filter({ hasText: /^cancel session$/i })
    .first()
    .click();
  await page.locator('p-toast').getByText(/session cancelled/i).waitFor({ timeout: 5000 });
  await snap(page, '05-instructor-cancel-success-toast');

  // 6. Back to list — verify the cancelled session is gone from Upcoming
  await page.goto('/coaching/sessions');
  await page.locator('mh-session-card, .mh-sessions__empty').first().waitFor({ timeout: 5000 });
  await snap(page, '06-instructor-list-after-cancel');
});

test('instructor flow walk: recurring template detail', async ({ page, request }) => {
  // Seed a recurring template so we always have one.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `Flow walk recurring ${Date.now()}`;
  const seeded = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/xyz',
      durationMinutes: 45,
      timezone: 'Europe/Bucharest',
      isRecurring: true,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1, 3],
        endAfterOccurrences: 4,
      },
      firstStartAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      generateInitialInstances: true,
    },
  });
  await expectSeedOk(seeded);

  await loginAsInstructor(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Recurring templates tab
  await page.goto('/coaching/sessions');
  await page.getByRole('tab', { name: /recurring/i }).click();
  // Filter BE-side by title (dev DB has many other recurring templates).
  // Search input debounces 200ms; wait a beat after typing so the
  // request fires before we look for the card.
  await page.getByPlaceholder(/search sessions/i).fill(title);
  await page.waitForTimeout(800);
  const targetCard = page.locator('mh-session-card', { hasText: title }).first();
  await targetCard.waitFor({ timeout: 10_000 });
  await snap(page, '10-instructor-recurring-tab');

  // Open template detail
  await targetCard.click();
  await page.waitForURL(/\/coaching\/sessions\/templates\/[0-9a-f-]{36}/);
  await page.waitForTimeout(800);
  await snap(page, '11-instructor-template-detail');
});

test('client flow walk: discover → showcase → book', async ({ page, request }) => {
  // Seed a fresh OPEN session the test USER can book.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `Flow walk bookable ${Date.now()}`;
  const seeded = await request.post('http://localhost:3800/sessions/templates', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-def-ghi',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    },
  });
  await expectSeedOk(seeded);

  await loginAsUser(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Discover
  await page.goto('/sessions/discover');
  await page.locator('mh-session-card, [data-testid="discover-empty"]').first().waitFor({ timeout: 10_000 });
  // Search for our seeded title so the test isn't sensitive to dev-DB noise.
  await page.getByPlaceholder(/search/i).first().fill(title);
  await page.waitForTimeout(500);
  await snap(page, '20-client-discover');

  // Click our specific card
  await page.locator('mh-session-card', { hasText: title }).first().click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  await page.locator('.mh-show__hero').waitFor({ timeout: 5000 });
  await snap(page, '21-client-showcase-bookable');

  // Click Book → dialog
  await page.getByRole('button').filter({ hasText: /^(Book|Reserve|Request to join)$/ }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  await snap(page, '22-client-book-dialog');

  // Confirm
  await page
    .getByRole('dialog')
    .getByRole('button')
    .filter({ hasText: /confirm booking|request to join/i })
    .first()
    .click();
  // Booking confirmed modal → "Go to My sessions"
  const confirmed = page.locator('mh-booking-confirmed-dialog');
  await confirmed
    .getByRole('heading', { name: /you're in|request sent/i })
    .waitFor({ timeout: 5000 });
  await snap(page, '23-client-booking-confirmed-modal');
  await confirmed.getByRole('button', { name: /go to my sessions/i }).click();
  await page.waitForURL(/\/my\/sessions/);
  await page.waitForTimeout(800);
  await snap(page, '23b-client-my-sessions-after-book');

  // Back to showcase → should now show "Booked" state
  await page.locator('[data-testid="my-row"]').first().click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  await page.locator('.mh-show__booked, .mh-show__hero').first().waitFor({ timeout: 5000 });
  await snap(page, '24-client-showcase-booked-state');

  // Back to Discover → the card should now show a "Booked" badge
  await page.goto('/sessions/discover');
  await page.waitForTimeout(1200);
  await snap(page, '25-client-discover-with-booked-badge');
});
