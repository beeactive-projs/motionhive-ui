import { test } from '@playwright/test';
import * as path from 'path';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Mobile create-session sheet — visual checks for frames 4A + 4B.
 * Opens the sheet, scrolls to the When section, toggles "Repeat on a
 * schedule" so the recurrence builder renders, snaps both states.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(60_000);

const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

async function snap(page: any, label: string) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, `${label}.png`),
    fullPage: true,
  });
  console.log('snap →', label);
}

test('mobile · create sheet shows recurrence builder when toggled', async ({
  page,
}) => {
  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);
  await page.goto('/coaching/sessions');
  await page.waitForSelector('mh-mobile-fab .mh-fab', { timeout: 10_000 });

  await page.locator('mh-mobile-fab .mh-fab').click();
  await page.waitForSelector('.mh-sf__body', { timeout: 5_000 });
  await snap(page, '03b-create-sheet-basics');

  // Scroll down to the When section, then the recurrence checkbox.
  const recurringCheckbox = page.locator('label[for="sfRecurring"]');
  await recurringCheckbox.scrollIntoViewIfNeeded();
  await snap(page, '03c-create-sheet-when');

  await recurringCheckbox.click();
  await page.waitForTimeout(400);
  await page.locator('mh-recurrence-builder').scrollIntoViewIfNeeded();
  await snap(page, '03d-create-sheet-recurring');
});
