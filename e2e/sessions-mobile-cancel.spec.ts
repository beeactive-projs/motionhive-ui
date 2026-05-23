import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Section 4C — cancel-session-dialog as a bottom sheet on mobile.
 * Opens the cancel sheet via the session-detail ⋮ → "Cancel session…"
 * path so we exercise the full UX, not just the dialog in isolation.
 *
 * Runs at both mobile + desktop viewports — the same spec serves as
 * a desktop-no-regression check.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

test.setTimeout(60_000);

async function pickInstanceId(page: any): Promise<string | null> {
  const apiToken = await page.evaluate(() =>
    localStorage.getItem('motionhive_access_token'),
  );
  const res = await page.request
    .get('http://localhost:3800/sessions/instances?limit=20&status=SCHEDULED', {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    .catch(() => null);
  if (!res || !res.ok()) return null;
  const body: any = await res.json().catch(() => ({}));
  const items = (body.items ?? body.data ?? []) as { id: string; status?: string }[];
  // The cancel sheet only renders the danger row when the instance is
  // still SCHEDULED — picking a cancelled/completed instance would
  // surface only "Open calendar" and the test would deadlock waiting
  // for the danger button.
  const scheduled = items.find((i) => i.status === 'SCHEDULED' || !i.status);
  return scheduled?.id ?? null;
}

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`cancel · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('opens cancel surface from session-detail', async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);
      const snap = async (label: string) => {
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(outDir, `${label}.png`),
          fullPage: true,
        });
        console.log(`[${name}] snap → ${label}`);
      };

      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
      await page.goto('/coaching/sessions');
      await page.waitForTimeout(500);

      const instanceId = await pickInstanceId(page);
      test.skip(!instanceId, 'no session instances seeded');
      await page.goto(`/coaching/sessions/${instanceId}`);

      if (name === 'mobile') {
        // Mobile path: tap ⋮ → action sheet → Cancel session…
        await page.waitForSelector('.mh-mob-sd__hero', { timeout: 10_000 });
        await page.locator('.mh-mob-sd__actions button').first().click();
        await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
        // Action list now lives inside <mh-action-list>. Target the
        // danger row explicitly via its CSS class so we don't match
        // both the action item AND the subsequent cancel sheet's
        // "Cancel session" header text.
        await page.locator('.mh-bs__sheet .mh-al__btn--danger').click();
        // The cancel sheet replaces the action sheet.
        await page.waitForTimeout(500);
        await page.waitForSelector(
          '.mh-bs__sheet:has-text("What should be cancelled")',
          { timeout: 5_000 },
        );
        await snap('08-cancel-sheet');
        // Tap the second radio (this and all future) if it exists.
        const opts = page.locator('.mh-cancel__opt');
        const count = await opts.count();
        if (count > 1) {
          await opts.nth(1).click();
          await snap('08b-cancel-sheet-this-and-future');
        }
        // Verify the foot has Keep + Cancel session buttons
        const sheet = page.locator('.mh-bs__sheet');
        await expect(sheet.getByText('Keep')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Cancel session' })).toBeVisible();
      } else {
        // Desktop path: header has explicit Cancel button.
        await page.waitForSelector('.mh-sd__hero', { timeout: 10_000 });
        await page.getByRole('button', { name: 'Cancel' }).first().click();
        await page.waitForSelector('.p-dialog:has-text("Cancel session")', {
          timeout: 5_000,
        });
        await snap('08-cancel-dialog');
      }
    });
  });
}
