import { test } from '@playwright/test';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Capture every /sessions/* HTTP call the FE makes during the initial
 * page load + after switching to Online filter. Surfaces the actual
 * URLs + response sizes so we can diff vs what the BE returns when
 * curled directly.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(45_000);

test('probe sessions network', async ({ page }) => {
  const calls: { url: string; status?: number; ms?: number; count?: number }[] = [];

  page.on('request', (req) => {
    const u = req.url();
    if (!u.includes('/sessions/')) return;
    calls.push({ url: u });
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (!u.includes('/sessions/')) return;
    const entry = calls.find((c) => c.url === u && c.status === undefined);
    if (!entry) return;
    entry.status = res.status();
    if (res.ok()) {
      try {
        const body = await res.json();
        const items = body?.items ?? body?.data ?? body;
        entry.count = Array.isArray(items) ? items.length : 1;
      } catch {
        entry.count = -1;
      }
    }
  });

  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('.mh-mob__pills, .mh-sessions__filters', { timeout: 15_000 });
  await page.waitForTimeout(2000);

  console.log('\n[initial-load]');
  for (const c of calls) {
    console.log(`  ${c.status ?? '???'} ${c.count ?? '-'} items  ${c.url}`);
  }

  // Tap Online
  calls.length = 0;
  await page.locator('.mh-mob__pill:has-text("Online")').first().click();
  await page.waitForTimeout(1500);
  console.log('\n[after Online pill]');
  for (const c of calls) {
    console.log(`  ${c.status ?? '???'} ${c.count ?? '-'} items  ${c.url}`);
  }

  // Tap In-person
  calls.length = 0;
  await page.locator('.mh-mob__pill:has-text("In-person")').first().click();
  await page.waitForTimeout(1500);
  console.log('\n[after In-person pill]');
  for (const c of calls) {
    console.log(`  ${c.status ?? '???'} ${c.count ?? '-'} items  ${c.url}`);
  }

  // Tap All
  calls.length = 0;
  await page.locator('.mh-mob__pill:has-text("All")').first().click();
  await page.waitForTimeout(1500);
  console.log('\n[after All pill]');
  for (const c of calls) {
    console.log(`  ${c.status ?? '???'} ${c.count ?? '-'} items  ${c.url}`);
  }
});
