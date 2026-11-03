// Keeps one headless Chromium alive for a review. Steps attach over CDP and drive
// context.pages()[0], so the signed-in session and the app's state survive between steps.
// Run it in the background and stop it when the review is done.
//   REVIEW_OUT  profile + screenshots folder (use the session scratchpad)
//   CDP_PORT    default 9333
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');

const out = process.env.REVIEW_OUT || path.join(os.tmpdir(), 'mh-review');
const port = process.env.CDP_PORT || '9333';

(async () => {
  // A touch Android phone at DPR 2: md mode by default, `?ionic:mode=ios` for iOS.
  const context = await chromium.launchPersistentContext(path.join(out, 'profile'), {
    headless: true,
    args: [`--remote-debugging-port=${port}`],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:8100/auth/login');
  console.log(`host ready: cdp ${port}, out ${out}`);
  await new Promise(() => {});
})();
