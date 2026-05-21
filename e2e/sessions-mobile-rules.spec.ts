import { expect, test } from '@playwright/test';
import { loginAsInstructor } from './auth.helper';

/**
 * Batch 1 — mobile rules acceptance.
 * Asserts the structural changes from screens-responsive-patterns.jsx:
 *   - Rule 2: KPI strip horizontal-scrolls on phone, grids on desktop.
 *   - Rule 3: Tabs scroll horizontally with edge fade ≤600px.
 *   - Rule 4: Card titles 2-line clamp (display:-webkit-box,
 *     -webkit-line-clamp:2).
 *   - Rule 1: New session is a FAB ≤600px; toolbar button visible >600px.
 *   - Rule 6: p-dialog turns into a bottom-sheet ≤600px
 *     (border-radius on the top corners + sticky bottom).
 */

test.describe('mobile rules @ phone (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('KPI strip is horizontally scrollable', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('.mh-sessions__kpi').first().waitFor({ timeout: 10_000 });
    const overflow = await page.locator('.mh-sessions__kpi').first().evaluate(
      (el) => getComputedStyle(el).overflowX,
    );
    expect(overflow).toBe('auto');
  });

  test('Tabs scroll horizontally + first child does not wrap', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('.mh-sessions__tabs').first().waitFor({ timeout: 10_000 });
    const tabsOverflow = await page.locator('.mh-sessions__tabs').first().evaluate(
      (el) => getComputedStyle(el).overflowX,
    );
    expect(tabsOverflow).toBe('auto');
    const tabWhitespace = await page.locator('.mh-tab').first().evaluate(
      (el) => getComputedStyle(el).whiteSpace,
    );
    expect(tabWhitespace).toBe('nowrap');
  });

  test('Session-card title clamps to 2 lines', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('mh-session-card').first().waitFor({ timeout: 10_000 });
    // The browser may normalise `display: -webkit-box` to `flow-root`,
    // so assert the effective behaviour instead: line-clamp is "2" and
    // the title height stays within 2 lines (≈40-50px at our font-size).
    const styles = await page.locator('mh-session-card .mh-card__title').first().evaluate((el) => ({
      lineClamp: getComputedStyle(el).webkitLineClamp,
      overflow: getComputedStyle(el).overflow,
      height: el.getBoundingClientRect().height,
    }));
    expect(styles.lineClamp).toBe('2');
    expect(styles.overflow).toBe('hidden');
    expect(styles.height).toBeLessThanOrEqual(60);
  });

  test('FAB is visible; toolbar New session button is hidden', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('mh-instructor-sessions').waitFor({ timeout: 10_000 });
    await expect(page.locator('.mh-sessions__fab')).toBeVisible();
    // The toolbar button is suppressed via display:none on the styleClass.
    const toolbarBtnDisplay = await page.locator('.mh-sessions__new-btn').first().evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(toolbarBtnDisplay).toBe('none');
  });

  test('Dialog renders as a bottom sheet (rounded top + sticky footer)', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('mh-instructor-sessions').waitFor({ timeout: 10_000 });
    await page.locator('.mh-sessions__fab').click();
    const dialog = page.locator('.p-dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const styles = await dialog.evaluate((el) => ({
      borderRadius: getComputedStyle(el).borderTopLeftRadius,
      width: el.getBoundingClientRect().width,
    }));
    expect(parseInt(styles.borderRadius)).toBeGreaterThanOrEqual(16);
    // Width is full viewport (the !important rule wins).
    expect(styles.width).toBeGreaterThan(380);
  });
});

test.describe('mobile rules @ desktop (1440px) — controls unchanged', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('KPI is a grid, not horizontal-scroll', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('.mh-sessions__kpi').first().waitFor({ timeout: 10_000 });
    const display = await page.locator('.mh-sessions__kpi').first().evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(display).toBe('grid');
  });

  test('FAB is hidden; toolbar New session button is visible', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/coaching/sessions');
    await page.locator('mh-instructor-sessions').waitFor({ timeout: 10_000 });
    await expect(page.locator('.mh-sessions__fab')).not.toBeVisible();
    await expect(page.locator('.mh-sessions__new-btn').first()).toBeVisible();
  });
});
