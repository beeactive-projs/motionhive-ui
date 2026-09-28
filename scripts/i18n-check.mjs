// Checks the runtime translation files for web + mobile (ngx-translate).
//
//   node scripts/i18n-check.mjs          (npm run i18n:check)
//
// Fails on:
//   - a key present in one language and missing from another (per file)
//   - an app file redefining a top-level namespace owned by the shared file
//   - a message that isn't valid ICU MessageFormat for its language (bad
//     braces, a plural category the language doesn't have)
//   - a non-string leaf (the compiler turns arrays/numbers into garbage)
// Warns on:
//   - keys used in code (`'x.y' | translate`, `instant('x.y')`,
//     `translate('x.y')`) that the English file doesn't define
//
// The website is not covered: it uses compile-time @angular/localize.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import MessageFormat from '@messageformat/core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LANGUAGES = ['en', 'ro'];
const SOURCE = 'en';

const SHARED = { name: 'shared', dir: 'projects/core/src/i18n', src: ['projects/core/src/lib'] };
const APPS = [
  { name: 'web', dir: 'projects/web/public/i18n', src: ['projects/web/src'] },
  { name: 'mobile', dir: 'projects/mobile/public/i18n', src: ['projects/mobile/src'] },
];

const errors = [];
const warnings = [];

function load(dir, lang) {
  const file = join(ROOT, dir, `${lang}.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`${dir}/${lang}.json: ${err.code === 'ENOENT' ? 'missing' : err.message}`);
    return {};
  }
}

/** Leaf paths → values, e.g. `button.save` → "Save". */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

function checkSet(set) {
  const flat = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(load(set.dir, l))]));

  for (const lang of LANGUAGES) {
    const mf = new MessageFormat(lang, { strictPluralKeys: true });
    for (const [key, value] of flat[lang]) {
      if (typeof value !== 'string') {
        errors.push(`${set.dir}/${lang}.json: ${key} is ${Array.isArray(value) ? 'an array' : typeof value}, not a string`);
        continue;
      }
      try {
        mf.compile(value);
      } catch (err) {
        errors.push(`${set.dir}/${lang}.json: ${key} is not valid ICU — ${err.message}`);
      }
    }
    if (lang === SOURCE) continue;
    for (const key of flat[SOURCE].keys()) {
      if (!flat[lang].has(key)) errors.push(`${set.dir}/${lang}.json: missing ${key}`);
    }
    for (const key of flat[lang].keys()) {
      if (!flat[SOURCE].has(key)) errors.push(`${set.dir}/${lang}.json: ${key} is not in ${SOURCE}.json`);
    }
  }
  return flat[SOURCE];
}

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'node_modules') sourceFiles(path, out);
    } else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) {
      out.push(path);
    }
  }
  return out;
}

// Literal keys only — a dynamic `'enum.' + domain` can't be checked statically.
const USAGE = [
  /['"]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"]\s*\|\s*translate\b/g,
  /\binstant\(\s*['"]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"]/g,
  /\btranslate\(\s*['"]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"]/g,
  /\bfieldError\s*:\s*\{[^}]*?['"]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"]/g,
];

function checkUsage(name, dirs, known) {
  for (const dir of dirs) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      let text = readFileSync(file, 'utf8');
      // Doc comments quote example keys; only live code counts.
      if (file.endsWith('.ts')) text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const pattern of USAGE) {
        for (const match of text.matchAll(pattern)) {
          const key = match[1];
          // A prefix of real keys (`instant('primeng')`) reads a whole block.
          const isBlock = [...known].some((k) => k.startsWith(`${key}.`));
          if (!known.has(key) && !isBlock) {
            warnings.push(`${name}: ${relative(ROOT, file)} uses '${key}', which ${SOURCE}.json doesn't define`);
          }
        }
      }
    }
  }
}

const shared = checkSet(SHARED);
const sharedNamespaces = new Set([...shared.keys()].map((k) => k.split('.')[0]));
checkUsage(SHARED.name, SHARED.src, new Set(shared.keys()));

for (const app of APPS) {
  const own = checkSet(app);
  for (const ns of new Set([...own.keys()].map((k) => k.split('.')[0]))) {
    if (sharedNamespaces.has(ns)) {
      errors.push(`${app.dir}: top-level '${ns}' is a shared namespace — add the key to ${SHARED.dir} instead`);
    }
  }
  checkUsage(app.name, app.src, new Set([...shared.keys(), ...own.keys()]));
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\ni18n: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
