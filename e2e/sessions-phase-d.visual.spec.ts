import { expect, test, type Page } from '@playwright/test';
import { INSTRUCTOR_FIXTURE, loginAsInstructor, mintToken } from './auth.helper';
import { expectSeedOk } from './seed.helper';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase D visual audit — drives every instructor session screen at 3
 * viewport widths and dumps full-page screenshots into
 * `e2e/__screenshots__/phase-d/`. The screenshots are then reviewed
 * by hand (or by the assistant) to spot layout / spacing / overflow /
 * contrast issues that the functional spec can't catch.
 *
 * This is NOT a visual-regression test (no baseline comparisons). It's a
 * "render every screen at every breakpoint, save to disk, look".
 */

const OUT_DIR = path.join(__dirname, '__screenshots__', 'phase-d');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'mobile', width: 375, height: 800 },
] as const;

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await loginAsInstructor(page);
});

async function snap(page: Page, name: string, vp: { name: string; width: number; height: number }) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  // Tiny grace period for any layout settling (skeletons, dialogs).
  await page.waitForTimeout(400);
  const file = path.join(OUT_DIR, `${name}__${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

for (const vp of VIEWPORTS) {
  test.describe(`Phase D visuals @ ${vp.name} (${vp.width}px)`, () => {
    test(`sessions list — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/coaching/sessions');
      // Wait for either a card OR the empty-state CTA — both indicate
      // the page has hydrated past the skeleton.
      await page
        .locator('mh-session-card, button:has-text("Create your first session")')
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => undefined);
      await snap(page, 'sessions-list', vp);
    });

    test(`sessions list — create dialog open — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/coaching/sessions');
      await page
        .getByRole('button', { name: /create your first session|new session|^\s*create\s*$/i })
        .first()
        .click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      await snap(page, 'create-dialog', vp);
      // Toggle recurrence + screenshot the recurrence builder
      await page.getByLabel(/repeat on a schedule/i).check();
      await page.waitForTimeout(300);
      await snap(page, 'create-dialog-recurring', vp);
    });

    test(`calendar — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/coaching/sessions/calendar');
      await page.locator('mh-calendar-grid').waitFor({ timeout: 10_000 });
      await page.waitForTimeout(800); // grid pulls instances after init
      await snap(page, 'calendar-week', vp);
    });

    test(`calendar — day view — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/coaching/sessions/calendar');
      await page.locator('mh-calendar-grid').waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: /^day$/i }).click();
      await page.waitForTimeout(400);
      await snap(page, 'calendar-day', vp);
    });

    test(`approvals inbox — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/coaching/sessions/approvals');
      await page.getByRole('heading', { name: /approvals/i }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(600);
      await snap(page, 'approvals', vp);
    });

    test(`session detail — ${vp.name}`, async ({ page, request }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Seed a one-off so the screenshot is of the instance detail page
      // regardless of what's already in the DB.
      const token = mintToken(INSTRUCTOR_FIXTURE);
      const title = `E2E visual ${Date.now()}`;
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

      await page.goto('/coaching/sessions');
      await page.getByPlaceholder(/search sessions/i).fill(title);
      await page.waitForTimeout(400);
      const card = page.locator('mh-session-card', { hasText: title }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.click();
      await page.waitForURL(/\/coaching\/sessions\/[0-9a-f-]{36}$/, { timeout: 5000 });
      await page.waitForTimeout(800);
      await snap(page, 'session-detail', vp);
    });
  });
}
