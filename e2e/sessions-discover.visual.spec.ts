import { test, type Page } from '@playwright/test';
import { loginAsUser } from './auth.helper';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '__screenshots__', 'phase-e');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'mobile', width: 375, height: 800 },
] as const;

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await loginAsUser(page);
});

async function snap(page: Page, name: string, vp: { name: string; width: number; height: number }) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}__${vp.name}.png`),
    fullPage: true,
  });
}

for (const vp of VIEWPORTS) {
  test(`discover page — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/sessions/discover');
    await page
      .locator('mh-session-card, [data-testid="discover-empty"]')
      .first()
      .waitFor({ timeout: 10_000 });
    await snap(page, 'discover', vp);
  });

  test(`showcase page — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/sessions/discover');
    const card = page.locator('mh-session-card').first();
    if ((await card.count()) === 0) test.skip(true, 'No sessions to navigate to');
    await card.click();
    await page.locator('.mh-show__hero, .mh-show__blocked').first().waitFor({ timeout: 5000 });
    await snap(page, 'showcase', vp);
  });

  test(`my-sessions page — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/my/sessions');
    await page
      .locator('[data-testid="my-row"], [data-testid="my-empty"]')
      .first()
      .waitFor({ timeout: 10_000 });
    await snap(page, 'my-sessions-upcoming', vp);
    // Switch to pendingApproval — for the USER fixture there's typically one
    // booking from the earlier curl test, so this tab shows a real row.
    await page.getByRole('tab', { name: /pending/i }).click();
    await page.waitForTimeout(300);
    await snap(page, 'my-sessions-pending', vp);
  });
}
