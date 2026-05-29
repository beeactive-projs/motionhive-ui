import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Capture the mobile datepicker as it currently renders inside the
 * create-session bottom sheet, so we can diagnose the overflow.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(45_000);

const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

test('datepicker mobile probe', async ({ page }) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('mh-mobile-fab .mh-fab', { timeout: 10_000 });

  await page.locator('mh-mobile-fab .mh-fab').click();
  await page.waitForSelector('.mh-sf__body', { timeout: 5_000 });

  // Scroll to the datepicker
  const dpInput = page.locator('p-datepicker input').first();
  await dpInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, 'datepicker-01-before-open.png'),
    fullPage: false,
  });

  // Open the datepicker
  await dpInput.click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(OUT, 'datepicker-02-after-open.png'),
    fullPage: false,
  });

  // Where does the overlay actually sit? List every fixed-position
  // candidate the datepicker might be rendering as.
  const candidates = await page.evaluate(() => {
    const out: any[] = [];
    document.querySelectorAll('body > *').forEach((el) => {
      const cs = getComputedStyle(el as Element);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
      const r = (el as Element).getBoundingClientRect();
      if (r.width < 100 || r.height < 100) return;
      out.push({
        tag: el.tagName.toLowerCase(),
        classes: (el as HTMLElement).className.toString().slice(0, 80),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      });
    });
    return out;
  });
  console.log('body-children-overlays:', JSON.stringify(candidates, null, 2));
});
