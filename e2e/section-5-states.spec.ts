import { test } from '@playwright/test';
import * as path from 'path';
import {
  INSTRUCTOR_FIXTURE,
  loginAsInstructor,
  loginAsUser,
} from './auth.helper';

/**
 * Section 5 visual probe.
 *   5A: skeleton — force visible by intercepting the templates+instances
 *       requests with a long delay before the first response.
 *   5B: rich empty — instructor with no templates would normally trigger;
 *       we don't have a "clean" user to log in as in this env, so we
 *       intercept the templates list to return an empty page and snap
 *       the resulting empty card.
 *   5C: capacity-full — load a public session showcase URL that is at
 *       capacity (intercept the public-instance endpoint).
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

test.setTimeout(60_000);

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`section-5 · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    const outDir = path.join(__dirname, '__screenshots__', vp.slug);
    const snap = async (page: any, label: string) => {
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(outDir, `${label}.png`),
        fullPage: true,
      });
      console.log(`[${name}] snap → ${label}`);
    };

    test('5A skeleton', async ({ page }) => {
      // Delay all sessions/* responses by 5s so the skeleton stays
      // mounted long enough to screenshot.
      await page.route('**/sessions/templates*', async (route) => {
        await new Promise((r) => setTimeout(r, 5000));
        await route.continue();
      });
      await page.route('**/sessions/instances*', async (route) => {
        await new Promise((r) => setTimeout(r, 5000));
        await route.continue();
      });
      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
      await page.goto('/coaching/sessions');
      await page.waitForSelector('mh-time-row-skeleton', { timeout: 8_000 });
      await snap(page, '11-skeleton');
    });

    test('5B rich empty', async ({ page }) => {
      // Force the Upcoming list to be empty so the rich empty state
      // renders. Templates → empty + instances → empty.
      await page.route('**/sessions/templates*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }),
        });
      });
      await page.route('**/sessions/instances*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100 }),
        });
      });
      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
      await page.goto('/coaching/sessions');
      await page.waitForSelector('.mh-sessions__empty--rich', { timeout: 8_000 });
      await snap(page, '12-empty-rich');
    });

    test('5C capacity-full', async ({ page }) => {
      // Intercept the public showcase endpoint to inject a fully
      // booked instance (capacity=1, confirmedCount=1).
      await page.route('**/sessions/instances/*/public', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-00000000aaaa',
            templateId: '00000000-0000-0000-0000-00000000bbbb',
            instructorId: 'aaaaaaaa-0000-0000-0000-000000000001',
            startAt: '2026-06-15T07:30:00.000Z',
            endAt: '2026-06-15T08:00:00.000Z',
            titleOverride: null,
            descriptionOverride: null,
            venueIdOverride: null,
            meetingUrlOverride: null,
            capacityOverride: null,
            isOverride: false,
            occurrenceIndex: 0,
            status: 'SCHEDULED',
            cancelReason: null,
            cancelledAt: null,
            confirmedCount: 12,
            pendingApprovalCount: 0,
            waitlistedCount: 3,
            attendedCount: null,
            conflictingInstanceIds: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
            template: {
              id: '00000000-0000-0000-0000-00000000bbbb',
              slug: 'run-club-long-saturday',
              title: 'Run club · long Saturday',
              description: 'Out and back along the river. All paces welcome.',
              type: 'GROUP',
              access: 'OPEN',
              approvalRequired: false,
              locationKind: 'IN_PERSON',
              meetingUrl: null,
              meetingProvider: null,
              durationMinutes: 30,
              timezone: 'Europe/Bucharest',
              capacity: 12,
              waitlistEnabled: true,
              cancellationCutoffHours: 24,
              priceAmountCents: 0,
              priceCurrency: 'RON',
              instructorId: 'aaaaaaaa-0000-0000-0000-000000000001',
              groupId: null,
              venueId: null,
              venue: null,
            },
            instructor: {
              id: 'aaaaaaaa-0000-0000-0000-000000000001',
              firstName: 'Andrei',
              lastName: 'Popescu',
              avatarUrl: null,
              handle: 'andrei',
            },
            venueOverride: null,
          }),
        });
      });
      await loginAsUser(page);
      await page.goto('/sessions/00000000-0000-0000-0000-00000000aaaa');
      await page.waitForSelector('.mh-show__full-card', { timeout: 8_000 });
      await snap(page, '13-capacity-full');
    });
  });
}
