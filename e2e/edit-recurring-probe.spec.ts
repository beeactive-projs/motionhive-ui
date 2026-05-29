import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Open edit on a RECURRING template — the user reported the save
 * button vanishes. Recurring opens recurrence-builder inline which
 * can grow the sheet body past the viewport.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(60_000);

const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

test('edit recurring template mobile', async ({ page }) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForTimeout(800);

  // Switch to Recurring tab
  await page.locator('.mh-mob__tab:has-text("Recurring templates")').click();
  await page.waitForTimeout(500);

  // Tap the first recurring row to open template-detail
  const row = page.locator('mh-time-row').first();
  await row.click();
  await page.waitForSelector('mh-page-shell', { timeout: 10_000 });
  await page.screenshot({
    path: path.join(OUT, '15-recurring-detail.png'),
    fullPage: false,
  });

  // Tap Edit button (template-detail header).
  const editBtn = page.getByRole('button', { name: /Edit/ }).first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT, '15b-recurring-edit-open.png'),
      fullPage: false,
    });

    // Scroll the sheet body to the bottom
    await page.evaluate(() => {
      const body = document.querySelector('.mh-bs__body, .p-dialog-content') as HTMLElement | null;
      if (body) body.scrollTop = body.scrollHeight;
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, '15c-recurring-edit-bottom.png'),
      fullPage: false,
    });

    // Inspect both possible footer locations
    const info = await page.evaluate(() => {
      const sheetFoot = document.querySelector('.mh-bs__foot') as HTMLElement | null;
      const dialogFoot = document.querySelector('.p-dialog-footer') as HTMLElement | null;
      const fn = (el: HTMLElement | null) =>
        el
          ? {
              rect: el.getBoundingClientRect(),
              text: el.innerText?.slice(0, 200),
              display: getComputedStyle(el).display,
            }
          : null;
      return { sheetFoot: fn(sheetFoot), dialogFoot: fn(dialogFoot) };
    });
    console.log('foot info:', JSON.stringify(info, null, 2));
  }
});
