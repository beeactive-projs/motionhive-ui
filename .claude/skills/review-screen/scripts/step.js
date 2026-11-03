// Runs one review step against the live page:  node step.js <path/to/step.js>
// Parameters go in env vars. A step exports `async (page, ctx) => result`; the result prints as JSON.
//
// ctx.wait(ms)                 pause
// ctx.shot(name)               screenshot into REVIEW_OUT/shots, returns the path (Read it to look)
// ctx.kit()                    inject a11y-lib.js; then page.evaluate(() => window.__a11y.contrast(...))
// ctx.calls()                  live array of API calls made from now on (method + path, tickets stripped)
// ctx.login(email, password)   sign in through the real form, lands on /tabs/*
// ctx.romanian()               render Romanian without writing to the account; returns an async undo
//
// Anything a step sets through this connection (routes, viewport, emulated media) is dropped when the
// step exits, so set it, measure and screenshot inside the same step.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = 'http://localhost:3800';
const APP = 'http://localhost:8100';

(async () => {
  const out = process.env.REVIEW_OUT || path.join(os.tmpdir(), 'mh-review');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.env.CDP_PORT || '9333'}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });

  const ctx = {
    app: APP,
    api: API,
    wait: (ms) => page.waitForTimeout(ms),
    shot: async (name) => {
      const file = path.join(out, 'shots', name + '.png');
      await page.screenshot({ path: file });
      return file;
    },
    kit: () => page.evaluate(fs.readFileSync(path.join(__dirname, 'a11y-lib.js'), 'utf8')),
    calls: () => {
      const list = [];
      page.on('request', (r) => {
        if (r.url().startsWith(API)) list.push(r.method() + ' ' + r.url().slice(API.length).replace(/ticket=[^&]+/, 'ticket=…'));
      });
      return list;
    },
    login: async (email, password) => {
      await page.evaluate(() => localStorage.clear()).catch(() => {});
      await page.goto(APP + '/auth/login');
      await page.waitForSelector('input[type="email"]', { timeout: 15000 });
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('ion-button[type="submit"]');
      await page.waitForURL(/\/tabs\//, { timeout: 15000 });
    },
    // The account's `language` beats the device's on every load, so the device key alone never
    // switches. Answer /users/me with 'ro' in this browser only; nothing reaches the database.
    romanian: async () => {
      const url = API + '/users/me';
      await page.route(url, async (route) => {
        const res = await route.fetch();
        await route.fulfill({ response: res, json: { ...(await res.json()), language: 'ro' } });
      });
      await page.evaluate(() => localStorage.setItem('motionhive_language', 'ro'));
      return async () => {
        await page.unroute(url);
        await page.evaluate(() => localStorage.setItem('motionhive_language', 'en'));
      };
    },
  };

  try {
    const step = require(path.resolve(process.argv[2]));
    console.log(JSON.stringify(await step(page, ctx), null, 1));
  } catch (error) {
    console.log('STEP ERROR', error.message.split('\n').slice(0, 6).join('\n'));
  }
  process.exit(0);
})();
