/**
 * Adds the missing <link rel="modulepreload"> hints to every prerendered
 * website page. Runs after `ng build website` (see `build:website`).
 *
 * Why: Angular emits at most 10 hints and none for the page's lazy route, so
 * the browser discovers the rest of the JS one import level at a time (main,
 * then Angular core, then the route, then its imports). On a phone that chain
 * was about 4 s of round trips before any button worked. With every file the
 * page needs hinted up front, they all download in parallel.
 *
 * Per page it hints: everything main-*.js imports statically (transitively),
 * plus the lazy chunk of the route that page renders and its static imports.
 * Routes are read from the built main-*.js itself
 * ({path:"about",loadComponent:()=>import("./chunk-X.js")}), so the hints
 * always match what ships. If that shape ever stops matching, the script warns
 * and the pages keep Angular's own hints; nothing breaks.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist/website/browser';
const LOCALE_DIRS = ['', 'ro'];

// The minifier quotes strings with " or ` depending on the chunking mode.
const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["`]\.\/([\w.-]+\.js)["`]/g;
const ROUTE = /\{path:["`]([^"`]*)["`],load(?:Component|Children):\(\)=>import\(["`]\.\/([\w.-]+\.js)["`]\)/g;

/** Every file `file` pulls in through static imports, itself included. */
function staticGraph(root, file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(join(root, file), 'utf8');
  for (const [, dep] of source.matchAll(STATIC_IMPORT)) staticGraph(root, dep, seen);
  return seen;
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return LOCALE_DIRS.includes(name) ? [] : htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/** `features/sessions` matches the route `features/:slug`; '' is home. */
function routeMatches(pattern, pagePath) {
  const a = pattern.split('/');
  const b = pagePath.split('/');
  if (pattern === '') return pagePath === '';
  if (a.length > b.length) return false;
  // loadChildren routes (e.g. `legal`) own every path below them.
  return a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}

let total = 0;
for (const locale of LOCALE_DIRS) {
  const root = join(DIST, locale);
  if (!existsSync(root)) continue;
  const main = readdirSync(root).find((f) => /^main-[\w-]+\.js$/.test(f));
  if (!main) continue;

  const mainSource = readFileSync(join(root, main), 'utf8');
  const routes = [...mainSource.matchAll(ROUTE)].map(([, path, chunk]) => ({ path, chunk }));
  if (!routes.length) console.warn(`[preload-hints] No lazy routes found in ${locale || 'en'}/${main}.`);
  const initial = staticGraph(root, main);

  for (const html of htmlFiles(root)) {
    const pagePath = relative(root, html).replace(/\\/g, '/').replace(/(^|\/)index(\.csr)?\.html$/, '');
    // Most specific match wins (`features/:slug` over `features`).
    const route = routes
      .filter((r) => routeMatches(r.path, pagePath))
      .sort((x, y) => y.path.split('/').length - x.path.split('/').length)[0];
    const wanted = new Set(initial);
    if (route && !html.endsWith('.csr.html')) staticGraph(root, route.chunk, wanted);
    wanted.delete(main);

    let page = readFileSync(html, 'utf8');
    if (!page.includes(`src="${main}"`)) continue;
    const missing = [...wanted].filter((f) => !page.includes(`href="${f}"`));
    if (!missing.length) continue;
    const links = missing.map((f) => `<link rel="modulepreload" href="${f}">`).join('');
    page = page.replace('</head>', `${links}</head>`);
    writeFileSync(html, page, 'utf8');
    total += missing.length;
  }
}
console.log(`[preload-hints] Added ${total} modulepreload hints.`);
