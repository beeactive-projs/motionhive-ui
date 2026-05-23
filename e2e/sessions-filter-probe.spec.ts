import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginAsInstructor, INSTRUCTOR_FIXTURE } from './auth.helper';

/**
 * Diagnostic probe — for each tab × filter combination on the instructor
 * sessions list, record:
 *   (a) what the BE returned (templates + instances, raw),
 *   (b) what the FE rendered (mh-time-row count + day separators).
 *
 * Writes a report at e2e/__screenshots__/mobile-survey/filter-probe.json so
 * we can diff predicted vs actual.
 */

const VIEWPORT = { width: 390, height: 844 };
const OUT = path.join(__dirname, '__screenshots__', 'mobile-survey');

test.use({ viewport: VIEWPORT });
test.setTimeout(90_000);

interface ProbeRow {
  scenario: string;
  tab: string;
  filter: string;
  renderedCount: number;
  daySeparators: string[];
  rowTitles: string[];
  apiTemplates: number;
  apiInstances: number;
}

test('probe sessions filters', async ({ page }) => {
  const report: ProbeRow[] = [];

  await loginAsInstructor(page, INSTRUCTOR_FIXTURE);

  // Hit the BE directly so we can compare against what the UI shows.
  await page.goto('/coaching/sessions');
  await page.waitForSelector('.mh-mob__agenda, .mh-sessions__groups, .mh-sessions__empty', {
    timeout: 15_000,
  });

  const apiToken = await page.evaluate(() =>
    localStorage.getItem('motionhive_access_token'),
  );

  async function api(query: string): Promise<any> {
    const res = await page.request
      .get(`http://localhost:3800${query}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      .catch(() => null);
    if (!res || !res.ok()) return null;
    return res.json().catch(() => null);
  }

  async function snapshot(scenario: string, tab: string, filter: string) {
    await page.waitForTimeout(600);
    // Read what the UI rendered.
    const daySeparators = await page
      .locator('mh-day-separator')
      .allInnerTexts()
      .catch(() => []);
    const rowTitles = await page
      .locator('mh-time-row')
      .evaluateAll((els) =>
        els.map((el) => {
          const t = el.querySelector('.mh-tr__title');
          return t?.textContent?.trim() ?? '';
        }),
      )
      .catch(() => []);
    // Hit BE with the same tab.
    const tplRes = await api(`/sessions/templates?tab=${tab}&limit=50`);
    const apiTemplates = tplRes?.items?.length ?? 0;
    // Pull instances for the next 60 days.
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + 60);
    const instRes = await api(
      `/sessions/instances?dateFrom=${encodeURIComponent(start.toISOString())}&dateTo=${encodeURIComponent(end.toISOString())}&status=SCHEDULED&limit=200`,
    );
    const apiInstances = instRes?.items?.length ?? 0;

    report.push({
      scenario,
      tab,
      filter,
      renderedCount: rowTitles.length,
      daySeparators,
      rowTitles,
      apiTemplates,
      apiInstances,
    });
    await page.screenshot({
      path: path.join(OUT, `probe-${scenario}.png`),
      fullPage: true,
    });
    console.log(`[probe] ${scenario}: rendered=${rowTitles.length}, days=${daySeparators.length}, apiTpls=${apiTemplates}, apiInsts=${apiInstances}`);
  }

  // Helper to click a filter pill (mobile branch).
  async function clickPill(text: string) {
    await page.locator(`.mh-mob__pill:has-text("${text}")`).first().click();
    await page.waitForTimeout(400);
  }

  async function clickTab(text: string) {
    await page.locator(`.mh-mob__tab:has-text("${text}")`).first().click();
    await page.waitForTimeout(700);
  }

  // ─── Tab × filter matrix ────────────────────────────────────────
  // 1. Upcoming + All
  await clickTab('Upcoming');
  await clickPill('All');
  await snapshot('01-upcoming-all', 'active', 'all');

  // 2. Upcoming + Online
  await clickPill('Online');
  await snapshot('02-upcoming-online', 'active', 'online');

  // 3. Upcoming + In-person
  await clickPill('In-person');
  await snapshot('03-upcoming-in-person', 'active', 'in-person');

  // 4. Back to All
  await clickPill('All');
  await snapshot('04-upcoming-all-again', 'active', 'all');

  // 5. Recurring
  await clickTab('Recurring templates');
  await snapshot('05-recurring-all', 'recurring', 'all');

  // 6. Past
  await clickTab('Past');
  await snapshot('06-past-all', 'ended', 'all');

  // 7. Cancelled
  await clickTab('Cancelled');
  await snapshot('07-cancelled-all', 'cancelled', 'all');

  fs.writeFileSync(
    path.join(OUT, 'filter-probe.json'),
    JSON.stringify(report, null, 2),
  );
  console.log('[probe] wrote report to', path.join(OUT, 'filter-probe.json'));
});
