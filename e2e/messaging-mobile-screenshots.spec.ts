import { test, request as pwRequest } from '@playwright/test';
import * as path from 'path';
import {
  INSTRUCTOR_FIXTURE,
  USER_FIXTURE,
  loginAsInstructor,
  mintToken,
} from './auth.helper';

/**
 * Visual survey of the redesigned Messaging mobile UI.
 *
 * Seeds a DM between the instructor + user fixtures (with the instructor's
 * messages already read by the user so the "Read" receipt renders), then
 * screenshots the inbox, an open chat, and the new-message sheet at mobile
 * + desktop, in light + dark.
 *
 * Assumes `ng serve web` on :4200 and the API on :3800.
 * Run with: npx playwright test messaging-mobile-screenshots
 */

const API = 'http://localhost:3800';

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

let conversationId = '';

test.setTimeout(180_000);

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  const instrTok = mintToken(INSTRUCTOR_FIXTURE);
  const userTok = mintToken(USER_FIXTURE);

  const send = (token: string, recipientId: string, body: string) =>
    ctx.post(`${API}/messaging/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { recipientId, body },
    });

  // them → me (renders as a "them" bubble in the instructor's view)
  await send(
    userTok,
    INSTRUCTOR_FIXTURE.id,
    "Could we move tomorrow's session 30 min later? Meeting running long 😅",
  );
  // me → them (two messages so the run + read receipt are visible)
  const r1 = await send(instrTok, USER_FIXTURE.id, 'Sure, no problem at all.');
  const j1 = (await r1.json()) as { conversation: { id: string } };
  conversationId = j1.conversation.id;
  await send(
    instrTok,
    USER_FIXTURE.id,
    "Let's do 6:30 instead of 6:00 — same warm-up, I'll just trim the cooldown.",
  );

  // The user reads the thread → the instructor's messages flip to "Read".
  await ctx.patch(`${API}/messaging/conversations/${conversationId}/read`, {
    headers: { Authorization: `Bearer ${userTok}` },
    data: {},
  });

  await ctx.dispose();
});

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${vpName} · ${theme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`messaging surfaces`, async ({ page }) => {
        const outDir = path.join(
          __dirname,
          '__screenshots__',
          'messaging',
          `${vpName}-${theme}`,
        );

        async function snap(label: string) {
          await page.waitForTimeout(700).catch(() => {});
          await page.screenshot({ path: path.join(outDir, `${label}.png`) });
          console.log(`[${vpName}·${theme}] snap →`, label);
        }

        // Dark theme is seeded before bootstrap so the .dark class is on
        // <html> from first paint.
        if (theme === 'dark') {
          await page.addInitScript(() =>
            localStorage.setItem('mh-active-theme', 'dark'),
          );
        }
        await loginAsInstructor(page, INSTRUCTOR_FIXTURE);

        // 1. Inbox
        await page.goto('/messages');
        await page
          .waitForSelector('.mh-conv-row', { timeout: 15_000 })
          .catch(() => {});
        await snap('01-inbox');

        // 2. Open the seeded conversation → chat with read receipt
        await page.goto(`/messages/${conversationId}`);
        await page
          .waitForSelector('.mh-bubble', { timeout: 15_000 })
          .catch(() => {});
        await snap('02-chat');

        // 3. New-message sheet (mobile) / panel (desktop)
        await page.goto('/messages');
        await page
          .waitForSelector('.mh-conv-row', { timeout: 15_000 })
          .catch(() => {});
        const newBtn = page.getByRole('button', { name: 'New message' }).first();
        if (await newBtn.isVisible().catch(() => false)) {
          await newBtn.click();
          await page
            .waitForSelector('.mh-picker', { timeout: 5_000 })
            .catch(() => {});
          await snap('03-new-message-empty');

          // Type to surface people suggestions.
          const search = page.locator('.mh-picker__search');
          if (await search.isVisible().catch(() => false)) {
            await search.fill('test');
            await page.waitForTimeout(900);
            await snap('04-new-message-search');
          }
        }
      });
    });
  }
}
