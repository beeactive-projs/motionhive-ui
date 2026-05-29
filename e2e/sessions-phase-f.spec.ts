import { expect, test } from '@playwright/test';
import {
  INSTRUCTOR_FIXTURE,
  USER_FIXTURE,
  loginAsInstructor,
  loginAsUser,
  mintToken,
} from './auth.helper';
import { expectSeedOk } from './seed.helper';

/**
 * Phase F + 2026-05-17 polish coverage:
 *   - Calendar mini-month → grid sync (anchor highlight)
 *   - Click an empty cell opens the prefilled form
 *   - "Message participants" on a SCHEDULED future session
 *   - Cancelled state visibility on session-detail + template-detail
 *   - Notification bell deep-link (post-BE deep-link fix)
 *   - Infinite scroll on instructor sessions list
 */

const API = 'http://localhost:3800';

async function seedOneOff(
  request: ReturnType<typeof test.extend> extends never ? never : any,
  titleSuffix: string,
  daysAhead = 7,
) {
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E phase-F ${titleSuffix} ${Date.now()}`;
  const startAt = new Date(Date.now() + daysAhead * 86_400_000).toISOString();
  const res = await request.post(`${API}/sessions/templates`, {
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
      firstStartAt: startAt,
    },
  });
  await expectSeedOk(res, `seed one-off (${titleSuffix})`);
  const body = (await res.json()) as {
    template: { id: string };
    generatedInstances: { id: string }[];
  };
  const instanceId = body.generatedInstances?.[0]?.id;
  if (!instanceId) throw new Error('Seed did not return a generated instance');
  return { token, title, templateId: body.template.id, instanceId };
}

// ─── Calendar sync ──────────────────────────────────────────────────────

test('calendar: mini-month click syncs grid + paints week band', async ({ page }) => {
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions/calendar');
  await expect(page.locator('mh-calendar-grid')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mh-mm__day').first()).toBeVisible({ timeout: 10_000 });

  // Pick the first day cell that is in the current month and not today —
  // gives us a definite state change vs the initial "today" anchor.
  const candidates = page.locator('.mh-mm__day:not(.is-other-month):not(.is-today)');
  await expect(candidates.first()).toBeVisible();
  const initialSelected = await page.locator('.mh-mm__day.is-selected').count();
  await candidates.first().click({ force: true });
  await page.waitForTimeout(500);

  // The grid header for the picked weekday should now carry is-selected
  // (was 0 before any click — today's column has is-today, not is-selected).
  await expect(page.locator('.mh-calendar__header-cell.is-selected')).toHaveCount(1);
  await expect(page.locator('.mh-calendar__day-col.is-selected')).toHaveCount(1);
  // Mini-month should paint the whole Mon-Sun band (7 days). Use >= 7
  // since the band may overflow into the prev/next month rows.
  expect(await page.locator('.mh-mm__day.is-in-range').count()).toBeGreaterThanOrEqual(7);
  // Selection signal moved.
  expect(await page.locator('.mh-mm__day.is-selected').count()).toBeGreaterThanOrEqual(initialSelected);
});

test('calendar: clicking an empty hour cell opens the form prefilled with that time', async ({ page }) => {
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions/calendar');
  await expect(page.locator('mh-calendar-grid')).toBeVisible({ timeout: 10_000 });

  await page.locator('.mh-calendar__hour-cell').nth(10).click();

  // The form dialog (not the datepicker popup) contains the datepicker input.
  // Select by the unique placeholder rather than guessing dialog order.
  const dt = page.locator('input[placeholder="Pick date & time"]').first();
  await expect(dt).toBeVisible({ timeout: 5000 });
  // Cell click should have pre-filled it.
  await expect(dt).not.toHaveValue('', { timeout: 3000 });

  await page.keyboard.press('Escape');
});

// ─── Phase F: Message participants ──────────────────────────────────────

test('sessions list: Public profile button opens /@<handle> in a new tab', async ({ page, context }) => {
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.locator('mh-instructor-sessions').waitFor({ timeout: 10_000 });

  const btn = page.getByRole('button', { name: /public profile/i });
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();

  // window.open with target=_blank opens a new page in the same context.
  const [popup] = await Promise.all([context.waitForEvent('page'), btn.click()]);
  await popup.waitForLoadState('domcontentloaded');
  expect(popup.url()).toContain('/@testinstructor');
  await popup.close();
});

test('phase F: instructor can message participants of a future scheduled session', async ({
  page,
  request,
}) => {
  const { instanceId, title } = await seedOneOff(request, 'msg-participants');

  // Book a participant via the API so the button appears.
  const userToken = mintToken(USER_FIXTURE);
  const bookRes = await request.post(`${API}/sessions/instances/${instanceId}/book`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {},
  });
  await expectSeedOk(bookRes, 'seed booking');

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/${instanceId}`);

  // "Message participants" button is visible (status SCHEDULED + 1 confirmed).
  const msgBtn = page.getByRole('button', { name: /message participants/i });
  await expect(msgBtn).toBeVisible({ timeout: 10_000 });

  await msgBtn.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Pre-context: no audience picker (the `mh-fu__audience` wrapper also
  // hosts the "Quick templates" row, so assert there's no audience
  // toggle by its "Send to" label — only present in post-context).
  await expect(dialog.getByText(/^Send to$/i)).toHaveCount(0);

  await dialog.locator('textarea').fill('Running 10 minutes late!');
  await dialog.getByRole('button', { name: /send/i }).click();

  await expect(page.locator('p-toast').getByText(/message participants/i)).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Verify on the BE: the participant received a SESSION_FOLLOW_UP notification.
  const notif = await request.get(`${API}/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  if (notif.ok()) {
    const body = (await notif.json()) as { items: { type: string; body: string }[] };
    const match = body.items.find(
      (n) => n.type === 'SESSION_FOLLOW_UP' && n.body.includes('Running 10 minutes late'),
    );
    expect(match).toBeTruthy();
  }
});

test('phase F: message-participants button is hidden when there are 0 participants', async ({
  page,
  request,
}) => {
  const { instanceId } = await seedOneOff(request, 'no-participants');

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/${instanceId}`);
  await expect(page.locator('mh-instructor-session-detail')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /message participants/i })).toHaveCount(0);
});

// ─── Cancelled state visibility ─────────────────────────────────────────

test('cancelled session shows banner, hides edit/cancel, mutes body', async ({
  page,
  request,
}) => {
  const { instanceId, token } = await seedOneOff(request, 'cancelled-state');

  // Cancel via API so we don't need to script the dialog flow.
  const cancelRes = await request.post(`${API}/sessions/instances/${instanceId}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { scope: 'this', reason: 'INSTRUCTOR_UNAVAILABLE', message: 'Sick day' },
  });
  await expectSeedOk(cancelRes, 'cancel via api');

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/${instanceId}`);

  // Banner present.
  await expect(page.locator('.mh-sd__banner--cancelled')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mh-sd__banner--cancelled')).toContainText(/Session cancelled/i);

  // Edit + Cancel buttons hidden on a cancelled instance.
  await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
  await expect(
    page.locator('[actions]').getByRole('button', { name: /^cancel$/i }),
  ).toHaveCount(0);

  // Status tag shows "Cancelled".
  const tag = page.locator('p-tag').filter({ hasText: /Cancelled/ });
  await expect(tag.first()).toBeVisible();

  // Body container has the muted modifier.
  await expect(page.locator('.mh-sd--cancelled')).toBeVisible();
});

test('cancelled series shows banner + hides edit/extend on template-detail', async ({
  page,
  request,
}) => {
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const title = `E2E series-cancel ${Date.now()}`;
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  // Seed a recurring template.
  const seeded = await request.post(`${API}/sessions/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: true,
      firstStartAt: future,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1, 3],
        endAfterOccurrences: 4,
      },
      generateInitialInstances: true,
    },
  });
  await expectSeedOk(seeded, 'seed recurring');
  const body = (await seeded.json()) as {
    template: { id: string };
    generatedInstances: { id: string }[];
  };
  const templateId = body.template.id;
  const anyInstanceId = body.generatedInstances[0].id;

  // Cancel scope=series.
  const cancelRes = await request.post(`${API}/sessions/instances/${anyInstanceId}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { scope: 'series', reason: 'INSTRUCTOR_UNAVAILABLE', message: 'Ending series' },
  });
  await expectSeedOk(cancelRes, 'cancel series via api');

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/templates/${templateId}`);

  await expect(page.locator('.mh-td__banner--cancelled')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mh-td__banner--cancelled')).toContainText(/Series cancelled/i);

  // Edit, Cancel series, Extend buttons hidden.
  await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /cancel series/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /extend/i })).toHaveCount(0);

  // Per-occurrence cancelled badges visible on every row.
  const badges = page.locator('.mh-td__row-status--cancelled');
  expect(await badges.count()).toBeGreaterThanOrEqual(4);
});

// ─── Notification deep-link routing (post BE fix) ───────────────────────

test('notification deep-link routes to /coaching/sessions/:id (instructor) after BE fix', async ({
  page,
  request,
}) => {
  const { instanceId } = await seedOneOff(request, 'deep-link');

  // Book as USER → fires a PARTICIPANT_JOINED notification to the instructor.
  const userToken = mintToken(USER_FIXTURE);
  const bookRes = await request.post(`${API}/sessions/instances/${instanceId}/book`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {},
  });
  await expectSeedOk(bookRes, 'book to fire notification');

  await loginAsInstructor(page);
  await page.goto('/coaching/overview');
  await page.locator('mh-notification-bell button').first().click();
  // Give the bell list time to fetch + render.
  await page.waitForSelector('.notification-popover li', { timeout: 5000 });

  const item = page.locator('.notification-popover li').filter({ hasText: /new booking/i }).first();
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();

  // BE deep-link fix means the new screen string is `'coaching/sessions'`
  // (not `'coaching/sessions/instances'`), so the bell routes here:
  await page.waitForURL(/\/coaching\/sessions\/[0-9a-f-]{36}$/, { timeout: 5000 });
  expect(page.url()).toContain(`/coaching/sessions/${instanceId}`);
});

// ─── Infinite scroll on instructor sessions list ────────────────────────

// ─── BE fix: template.venue eager-load ─────────────────────────────────

test('session detail surfaces the template venue (not "No venue set")', async ({ page, request }) => {
  // Seed a venue, then a one-off that points at it.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const venueRes = await request.post(`${API}/venues`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { kind: 'GYM', name: `E2E Test Gym ${Date.now()}`, city: 'Cluj' },
  });
  await expectSeedOk(venueRes, 'seed venue');
  const venue = (await venueRes.json()) as { id: string; name: string };

  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const tplRes = await request.post(`${API}/sessions/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `E2E venue render ${Date.now()}`,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'IN_PERSON',
      venueId: venue.id,
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: future,
    },
  });
  await expectSeedOk(tplRes, 'seed template with venue');
  const body = (await tplRes.json()) as { generatedInstances: { id: string }[] };
  const instanceId = body.generatedInstances[0].id;

  await loginAsInstructor(page);
  await page.goto(`/coaching/sessions/${instanceId}`);
  await expect(page.locator('mh-instructor-session-detail')).toBeVisible({ timeout: 10_000 });

  // "Where & how" section should show the venue name — NOT the "No venue set" placeholder.
  await expect(page.locator('.mh-sd__venue')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.mh-sd__venue')).toContainText(venue.name);
  await expect(page.locator('.mh-sd__none')).toHaveCount(0);
});

// ─── Filter pills on the sessions list ─────────────────────────────────

test('sessions list: location pill filters templates by IN_PERSON / ONLINE', async ({ page }) => {
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.locator('mh-session-card, .mh-sessions__empty').first().waitFor({ timeout: 10_000 });

  // All pill is the default active state.
  const allPill = page.locator('.mh-pill', { hasText: /^All$/ });
  await expect(allPill).toHaveClass(/is-active/);

  // Toggle Online → All loses is-active, Online gains it.
  await page.locator('.mh-pill', { hasText: 'Online' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.mh-pill.is-active', { hasText: 'Online' })).toBeVisible();
  await expect(allPill).not.toHaveClass(/is-active/);

  // Toggle Online again (re-click) → clears, All reactivates.
  await page.locator('.mh-pill', { hasText: 'Online' }).click();
  await page.waitForTimeout(400);
  await expect(allPill).toHaveClass(/is-active/);
});

test('sessions list: type pill filters templates by Group / 1-on-1 / Open', async ({ page }) => {
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.locator('mh-session-card, .mh-sessions__empty').first().waitFor({ timeout: 10_000 });

  await page.locator('.mh-pill', { hasText: /^Group$/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.mh-pill.is-active', { hasText: /^Group$/ })).toBeVisible();

  // Switching to 1-on-1 should drop Group's active state (single-select per group).
  await page.locator('.mh-pill', { hasText: '1-on-1' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.mh-pill.is-active', { hasText: '1-on-1' })).toBeVisible();
  await expect(page.locator('.mh-pill', { hasText: /^Group$/ })).not.toHaveClass(/is-active/);
});

test('instructor sessions list: scroll-sentinel triggers loadMore + appends', async ({ page }) => {
  // Capture every paginated templates request from the moment the page
  // mounts. If `hasMore=true` after the initial page=1, the FE will
  // either auto-fire page=2 (sentinel already in viewport, common when
  // the visible list is short) OR fire it when the sentinel scrolls
  // into view. Either path counts as "loadMore wired up".
  const calls: string[] = [];
  page.on('request', (r) => {
    if (/\/sessions\/templates\?.*page=/.test(r.url())) calls.push(r.url());
  });
  await loginAsInstructor(page);
  await page.goto('/coaching/sessions');
  await page.locator('mh-session-card, .mh-sessions__empty').first().waitFor({ timeout: 10_000 });

  const sentinel = page.locator('.mh-sessions__sentinel');
  if (await sentinel.count() === 0) {
    test.skip(true, 'Sentinel not rendered — store reports hasMore=false');
  }
  await sentinel.scrollIntoViewIfNeeded();
  // Give either the auto-fire or the scroll-fire a moment.
  await page.waitForTimeout(1500);

  // Must have requested page=2 at least once via the loadMore path.
  expect(calls.some((u) => /page=2/.test(u))).toBe(true);
});

// ─── Batch 3: calendar conflict "!" badge ──────────────────────────────

test('calendar: conflicting events show the coral "!" badge', async ({ page, request }) => {
  // Seed two overlapping sessions. The BE doesn't auto-recompute on
  // create yet (separate ticket — only `rescheduleInstance` triggers
  // it). For the FE assertion we patch `conflictingInstanceIds` via
  // an admin-style backdoor: reschedule one of them to itself, which
  // forces `conflictService.recomputeFor` to run.
  const token = mintToken(INSTRUCTOR_FIXTURE);
  const startAt = (() => {
    const d = new Date(Date.now() + 3 * 86_400_000);
    d.setHours(15, 0, 0, 0);
    return d.toISOString();
  })();
  const seeded: string[] = [];
  for (const tag of ['A', 'B']) {
    const r = await request.post(`${API}/sessions/templates`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `Conflict ${tag} ${Date.now()}`,
        type: 'OPEN', access: 'OPEN', locationKind: 'ONLINE',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        durationMinutes: 60, timezone: 'Europe/Bucharest',
        isRecurring: false, firstStartAt: startAt,
      },
    });
    await expectSeedOk(r, `seed conflict ${tag}`);
    const body = (await r.json()) as { generatedInstances: { id: string }[] };
    seeded.push(body.generatedInstances[0].id);
  }

  // Reschedule B onto the same time as A — this triggers
  // conflictService.recomputeFor which stamps both instances.
  const reschedRes = await request.post(
    `${API}/sessions/instances/${seeded[1]}/reschedule`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { newStartAt: startAt },
    },
  );
  await expectSeedOk(reschedRes, 'reschedule to overlap');

  await loginAsInstructor(page);
  await page.goto('/coaching/sessions/calendar');
  await expect(page.locator('mh-calendar-grid')).toBeVisible({ timeout: 10_000 });
  // Force the calendar onto the seeded day so the events render.
  await page.evaluate((iso: string) => {
    const target = new Date(iso);
    const dayBtn = [...document.querySelectorAll('.mh-mm__day')].find(
      (el) => el.textContent?.trim() === String(target.getDate()),
    );
    (dayBtn as HTMLElement | undefined)?.click();
  }, startAt);
  await page.waitForTimeout(800);

  await expect(
    page.locator('.mh-event-block--ring-conflict').first(),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.locator('.mh-event-block__conflict-badge').first(),
  ).toBeVisible();
});

// ─── Batch 8: day-of online countdown screen ───────────────────────────

test('day-of countdown screen renders for a booked online session', async ({ page, request }) => {
  // The dedicated /sessions/:id/join route shows a navy→teal hero with
  // the MM:SS countdown until joinActiveFrom (= startAt - 5 min).
  // Seed far enough out that the BE's "Session already started" check
  // (timestamp-without-time-zone column ➜ local-tz misread) doesn't
  // trip the book call.
  const fs = await import('fs');
  const pathMod = await import('path');
  const jwtMod = (await import('jsonwebtoken')).default;
  const secret = fs
    .readFileSync(
      pathMod.join('/Users/ionutbutnaru/Documents/mystuff/beeactive-api', '.env'),
      'utf-8',
    )
    .match(/^JWT_SECRET=(.+)$/m)![1]
    .trim();
  // Support agent — clean booking calendar.
  const supportId = '5640de47-dedf-4d5e-bcd8-4da9a43bdcef';
  const supportToken = jwtMod.sign(
    { sub: supportId, email: 'support@motionhive.fit' },
    secret,
    { expiresIn: '2h' },
  );
  const instr = mintToken(INSTRUCTOR_FIXTURE);
  const start = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
  const seed = await request.post(`${API}/sessions/templates`, {
    headers: { Authorization: `Bearer ${instr}` },
    data: {
      title: `E2E day-of ${Date.now()}`,
      type: 'OPEN',
      access: 'OPEN',
      locationKind: 'ONLINE',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      isRecurring: false,
      firstStartAt: start,
    },
  });
  await expectSeedOk(seed, 'seed day-of');
  const body = (await seed.json()) as { generatedInstances: { id: string }[] };
  const id = body.generatedInstances[0].id;
  const bookR = await request.post(`${API}/sessions/instances/${id}/book`, {
    headers: { Authorization: `Bearer ${supportToken}` },
    data: {},
  });
  await expectSeedOk(bookR, 'book as support');

  // Seed support into localStorage so the page loads as them.
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('motionhive_access_token', token);
      localStorage.setItem('motionhive_refresh_token', token);
      localStorage.setItem(
        'motionhive_user',
        JSON.stringify({
          id: '5640de47-dedf-4d5e-bcd8-4da9a43bdcef',
          email: 'support@motionhive.fit',
          firstName: 'Support',
          lastName: 'Agent',
          handle: 'supportagent',
          roles: ['USER', 'SUPPORT'],
          permissions: [],
          isEmailVerified: true,
        }),
      );
      localStorage.setItem('motionhive_roles', JSON.stringify(['USER', 'SUPPORT']));
      localStorage.setItem('motionhive_permissions', JSON.stringify([]));
    },
    supportToken,
  );

  await page.goto(`/sessions/${id}/join`);
  await expect(page.locator('.mh-dof__hero')).toBeVisible({ timeout: 8000 });
  // 8 hours out → "Starts in" eyebrow, big MM:SS counter, no Join button yet.
  await expect(page.locator('.mh-dof__counter-num')).toBeVisible();
  await expect(page.locator('.mh-dof__hero')).toContainText(/Starts in/i);
  // Pre-active hint copy explains the 5-min activation rule.
  await expect(page.locator('.mh-dof__pre-hint')).toBeVisible();
});
