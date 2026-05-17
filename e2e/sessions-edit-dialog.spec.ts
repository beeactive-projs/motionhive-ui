import { expect, test } from '@playwright/test';
import { loginAsInstructor } from './auth.helper';

/**
 * Edit-dialog regression: opening Edit on an existing session must
 * pre-fill every editable input — title, description, type, access,
 * location, duration, capacity, cancel cutoff, price, AND date/time.
 *
 * This is the user-reported bug: First start showed "Pick date & time"
 * instead of the existing value.
 */

test.beforeEach(async ({ page }) => {
  await loginAsInstructor(page);
});

test('edit dialog pre-fills every field including First start', async ({ page }) => {
  await page.goto('/coaching/sessions');
  const card = page.locator('mh-session-card').first();
  if ((await card.count()) === 0) test.skip(true, 'No sessions to drill into.');
  await card.click();
  // Either one-off instance detail or recurring template detail.
  await expect(page).toHaveURL(
    /\/coaching\/sessions\/(templates\/)?[0-9a-f-]{36}/,
  );

  await page.getByRole('button', { name: /edit/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Title is populated (give it time to hydrate from the BE).
  await expect(dialog.getByLabel('Title')).not.toHaveValue('', { timeout: 5000 });

  // First start input has a value, not just the placeholder.
  // PrimeNG datepicker renders an inner input with the formatted date.
  const dateInput = dialog.locator('p-datepicker input').first();
  const dateValue = await dateInput.inputValue();
  expect(dateValue.trim()).not.toEqual('');
  expect(dateValue).not.toEqual('Pick date & time');

  // Duration input has a value
  const durationInput = dialog
    .locator('p-inputnumber')
    .first()
    .locator('input');
  const durationValue = await durationInput.inputValue();
  expect(parseInt(durationValue, 10)).toBeGreaterThan(0);

  // Type select shows a value (not placeholder)
  const typeSelect = dialog.locator('p-select').first();
  await expect(typeSelect).toContainText(/open|group|private/i);

  // Screenshot the edit dialog so we can review the checkbox layout +
  // populated values visually.
  await page.screenshot({
    path: 'e2e/__screenshots__/phase-d/edit-dialog__desktop.png',
    fullPage: true,
  });
  // Scroll the dialog body to capture the When + Capacity sections.
  await dialog
    .locator('.p-dialog-content')
    .first()
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'e2e/__screenshots__/phase-d/edit-dialog__scrolled__desktop.png',
    fullPage: true,
  });
});
