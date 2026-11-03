// The worst case: an iPhone SE (375 × 667) at the 130% text cap, optionally in Romanian.
//   URL, WAIT_FOR   as in sweep.js
//   LANG_CODE       ro to render Romanian (through ctx.romanian(), nothing is saved), default en
// Restores the viewport, the text size and the language afterwards.
module.exports = async (page, ctx) => {
  const { URL, WAIT_FOR = 'ion-content', LANG_CODE = 'en' } = process.env;
  const undo = LANG_CODE === 'ro' ? await ctx.romanian() : null;
  await page.setViewportSize({ width: 375, height: 667 });
  try {
    await page.goto(ctx.app + URL);
    await page.waitForSelector(WAIT_FOR, { timeout: 15000 });
    // TextSizeService owns the root size; this stands in for the phone's 130% setting.
    await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; });
    await ctx.wait(1500);
    await ctx.kit();
    return {
      lang: await page.evaluate(() => document.documentElement.lang),
      overflow: await page.evaluate(() => window.__a11y.overflow()),
      rows: await page.evaluate(() => window.__a11y.rows()),
      contrast: await page.evaluate(() => window.__a11y.contrast()),
      // An untranslated key leaks as a whole word of dotted camelCase parts (`clients.list.search`);
      // an email's local part is not a whole word, so it does not match.
      keys: await page.evaluate(() =>
        [...document.body.innerText.matchAll(/(?:^|\s)([a-z]+(?:\.[a-z][a-zA-Z]+){2,})(?=\s|$)/gm)].map((m) => m[1]),
      ),
      shot: await ctx.shot(`large-${LANG_CODE}-${URL.replace(/[^a-z0-9]+/gi, '-')}`),
    };
  } finally {
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 390, height: 844 });
    if (undo) await undo();
  }
};
