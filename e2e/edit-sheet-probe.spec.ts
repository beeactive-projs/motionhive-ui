import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Open the edit-session sheet and screenshot it at mobile + desktop
 * to see why the Save button isn't visible. Suspect: sheet footer is
 * being clipped on iOS bottom-bar or PrimeNG ng-template foot isn't
 * projecting through the bottom-sheet's [foot] slot.
 */
test.setTimeout(60_000);

const VIEWPORTS = {
  mobile: { width: 390, height: 844, slug: 'mobile-survey' },
  desktop: { width: 1440, height: 900, slug: 'desktop-survey' },
} as const;

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`edit-sheet · ${name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('open edit sheet from session-detail', async ({ page }) => {
      const outDir = path.join(__dirname, '__screenshots__', vp.slug);
      const snap = async (label: string) => {
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(outDir, `${label}.png`),
          fullPage: false,
        });
        console.log(`[${name}] snap → ${label}`);
      };

      await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
      await page.goto('/coaching/sessions');
      await page.waitForTimeout(1000);

      // Grab an instance id from BE
      const apiToken = await page.evaluate(() =>
        localStorage.getItem('motionhive_access_token'),
      );
      const res = await page.request.get(
        'http://localhost:3800/sessions/instances?limit=10&status=SCHEDULED',
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
      const body = await res.json();
      const inst = body.items?.[0];
      test.skip(!inst, 'no instance');

      await page.goto(`/coaching/sessions/${inst.id}`);
      if (name === 'mobile') {
        await page.waitForSelector('.mh-mob-sd__hero', { timeout: 10_000 });
        await page.locator('.mh-mob-sd__actions button').first().click();
        await page.waitForSelector('.mh-bs__sheet', { timeout: 5_000 });
        await page.locator('.mh-bs__sheet').getByText(/Edit session/).click();
      } else {
        await page.waitForSelector('.mh-sd__hero', { timeout: 10_000 });
        await page.getByRole('button', { name: 'Edit' }).first().click();
      }
      await page.waitForTimeout(600);
      await snap('14-edit-open');

      // For mobile: scroll inside the sheet to the bottom — Save button
      // is supposed to be a sticky footer.
      if (name === 'mobile') {
        await page.evaluate(() => {
          const body = document.querySelector('.mh-bs__body') as HTMLElement | null;
          if (body) body.scrollTop = body.scrollHeight;
        });
        await snap('14b-edit-scrolled-bottom');
      }

      // Inspect the foot slot
      const footInfo = await page.evaluate(() => {
        const foot = document.querySelector('.mh-bs__foot') as HTMLElement | null;
        if (!foot) return { exists: false };
        const r = foot.getBoundingClientRect();
        return {
          exists: true,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          html: foot.innerHTML.slice(0, 500),
          display: getComputedStyle(foot).display,
        };
      });
      console.log(`[${name}] foot:`, JSON.stringify(footInfo));
    });
  });
}
