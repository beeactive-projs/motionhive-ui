// The four-combination sweep: loads URL in each of COMBOS and runs the kit there, with a screenshot each.
//   URL       app path, e.g. /tabs/clients
//   WAIT_FOR  a selector that means the screen has its data, e.g. mh-client-row
//   COMBOS    default light-md,dark-md,light-ios,dark-ios
//   KIT       default contrast,targets,ionicNames,headings,live,small,rows
//   NAME      screenshot prefix, default from the URL
module.exports = async (page, ctx) => {
  const { URL, WAIT_FOR = 'ion-content' } = process.env;
  const combos = (process.env.COMBOS || 'light-md,dark-md,light-ios,dark-ios').split(',');
  const kit = (process.env.KIT || 'contrast,targets,ionicNames,headings,live,small,rows').split(',');
  const name = process.env.NAME || URL.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const out = {};
  for (const combo of combos) {
    const [theme, mode] = combo.split('-');
    await page.evaluate((t) => localStorage.setItem('mh-mobile-theme', t), theme);
    const url = ctx.app + URL + (mode === 'ios' ? (URL.includes('?') ? '&' : '?') + 'ionic:mode=ios' : '');
    const calls = ctx.calls();
    await page.goto(url);
    await page.waitForSelector(WAIT_FOR, { timeout: 15000 });
    await ctx.wait(1800);
    await ctx.kit();
    const result = { mode: await page.evaluate(() => document.documentElement.getAttribute('mode')) };
    for (const fn of kit) result[fn] = await page.evaluate((f) => window.__a11y[f](), fn);
    result.calls = [...calls];
    result.shot = await ctx.shot(`${name}-${combo}`);
    out[combo] = result;
  }
  await page.evaluate(() => localStorage.setItem('mh-mobile-theme', 'light'));
  return out;
};
