// Mechanical facts for /pr-review: the diff, its size, translation problems, mobile convention hits and risky
// patterns on the lines the change added, and pointers for the reviewers.
// Usage: node diff-facts.mjs --tree <MotionHive-UI folder under review> --base <commit> --out <folder>
// The tree's working copy is the head: a detached worktree for someone else's branch, or the checkout itself
// (uncommitted and untracked files included). Writes diff.patch, i18n.patch, outside.patch and facts.md to --out,
// prints a JSON summary. Self-contained: no node_modules needed, so it runs against a bare worktree.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []),
);
if (!args.tree || !args.base || !args.out) {
  console.error('usage: node diff-facts.mjs --tree <MotionHive-UI folder> --base <commit> --out <folder>');
  process.exit(2);
}
const tree = path.resolve(args.tree);
const base = args.base;
const out = path.resolve(args.out);
if (!fs.existsSync(path.join(tree, 'projects', 'mobile', 'src'))) {
  console.error(`no MotionHive-UI tree at ${tree}`);
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

// A worktree in the scratchpad can push the deepest native paths past Windows' 260-character limit.
const git = (gitArgs) =>
  execFileSync('git', ['-c', 'core.longpaths=true', '-c', 'core.quotepath=false', ...gitArgs], {
    cwd: tree,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const baseContent = (relativePath) => {
  try {
    return git(['show', `${base}:${relativePath}`]);
  } catch {
    return null;
  }
};
const exists = (relativePath) => fs.statSync(path.join(tree, relativePath), { throwIfNoEntry: false })?.isFile() ?? false;
const readTree = (relativePath) => (exists(relativePath) ? fs.readFileSync(path.join(tree, relativePath), 'utf8') : null);

// --- what is reviewed ---

// Generated or vendored paths nobody reviews.
const NOISE = ['package-lock.json', 'dist', '.angular', 'android/app/src/main/assets/public', 'ios/App/App/public'];
const NOISE_SPECS = NOISE.map((noise) => `:(exclude)${noise}`);
const isNoise = (file) => NOISE.some((noise) => file === noise || file.startsWith(`${noise}/`));

const I18N = {
  core: { en: 'projects/core/src/i18n/en.json', ro: 'projects/core/src/i18n/ro.json' },
  mobile: { en: 'projects/mobile/public/i18n/en.json', ro: 'projects/mobile/public/i18n/ro.json' },
};
const I18N_FILES = new Set(Object.values(I18N).flatMap((set) => [set.en, set.ro]));
const OUTSIDE_I18N = /^projects\/(web\/public\/i18n\/\w+\.json|website\/src\/locale\/messages.*\.xlf)$/;
const isI18n = (file) => I18N_FILES.has(file);

/** mobile and core are reviewed; native and root config ride along; web, website and admin are outside. */
const scopeOf = (file) => {
  if (/(^|\/)\.claude\//.test(file) || file.startsWith('docs/') || /\.md$/i.test(file)) return 'docs';
  if (file.startsWith('projects/mobile/')) return 'mobile';
  if (file.startsWith('projects/core/')) return 'core';
  if (/^projects\/(web|website|admin)\//.test(file)) return 'outside';
  if (/^(android|ios)\//.test(file) || /^capacitor\.config\./.test(file)) return 'native';
  return 'root';
};
const REVIEWED = new Set(['mobile', 'core', 'native', 'root']);
const isCode = (file) =>
  !isI18n(file) && /\.(ts|html|scss|css|js|mjs|cjs|json|gradle|kts|swift|kt|java|xml|plist|entitlements)$/.test(file);
const OUTSIDE_SPECS = ['projects/web', 'projects/website', 'projects/admin'].map((dir) => `:(exclude)${dir}`);

/** path → { status, oldPath, added, deleted, addedLines: Set<number>, binary, untracked } */
const files = new Map();

const nameStatus = git(['diff', '--name-status', '-z', '-M', base, '--', '.', ...NOISE_SPECS]).split('\0').filter(Boolean);
for (let index = 0; index < nameStatus.length; ) {
  const status = nameStatus[index++];
  const oldPath = status.startsWith('R') || status.startsWith('C') ? nameStatus[index++] : null;
  const file = nameStatus[index++];
  files.set(file, { status: status[0], oldPath, added: 0, deleted: 0, addedLines: new Set() });
}

const numstat = git(['diff', '--numstat', '-z', '-M', base, '--', '.', ...NOISE_SPECS]).split('\0');
for (let index = 0; index < numstat.length; index++) {
  const match = /^(-|\d+)\t(-|\d+)\t(.*)$/.exec(numstat[index]);
  if (!match) continue;
  // A rename leaves the path empty and puts old and new paths in the next two fields.
  const file = match[3] || numstat[(index += 2)];
  const entry = files.get(file);
  if (entry) Object.assign(entry, { added: Number(match[1]) || 0, deleted: Number(match[2]) || 0, binary: match[1] === '-' });
}

let currentFile = null;
for (const line of git(['diff', '-U0', '-M', '--no-color', base, '--', '.', ...NOISE_SPECS]).split('\n')) {
  if (line.startsWith('+++ ')) {
    currentFile = line === '+++ /dev/null' ? null : line.slice(6).replace(/^"|"$/g, '');
    continue;
  }
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (hunk && currentFile && files.has(currentFile)) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let number = start; number < start + count; number++) files.get(currentFile).addedLines.add(number);
  }
}

// Untracked files exist only in a checkout with work in progress; every line is new.
const untracked = git(['ls-files', '--others', '--exclude-standard', '-z', '--', '.']).split('\0').filter((file) => file && !isNoise(file));
const untrackedPatches = { reviewed: [], outside: [], i18n: [] };
for (const file of untracked) {
  const buffer = fs.readFileSync(path.join(tree, file));
  if (buffer.includes(0)) {
    files.set(file, { status: 'A', oldPath: null, added: 0, deleted: 0, addedLines: new Set(), binary: true, untracked: true });
    continue;
  }
  const lines = buffer.toString('utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  files.set(file, { status: 'A', oldPath: null, added: lines.length, deleted: 0, addedLines: new Set(lines.map((_, index) => index + 1)), untracked: true });
  const patch = `diff --git a/${file} b/${file}\nnew file (untracked)\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((text) => `+${text}`).join('\n')}\n`;
  const bucket = isI18n(file) ? 'i18n' : scopeOf(file) === 'outside' ? 'outside' : 'reviewed';
  untrackedPatches[bucket].push(patch);
}

const I18N_EXCLUDES = [...I18N_FILES].map((file) => `:(exclude)${file}`);
fs.writeFileSync(
  path.join(out, 'diff.patch'),
  git(['diff', '-M', '--no-color', base, '--', '.', ...I18N_EXCLUDES, ...OUTSIDE_SPECS, ...NOISE_SPECS]) + untrackedPatches.reviewed.join(''),
);
fs.writeFileSync(path.join(out, 'i18n.patch'), git(['diff', '--no-color', base, '--', ...I18N_FILES]) + untrackedPatches.i18n.join(''));
fs.writeFileSync(
  path.join(out, 'outside.patch'),
  git(['diff', '-M', '--no-color', base, '--', 'projects/web', 'projects/website', 'projects/admin']) + untrackedPatches.outside.join(''),
);

const live = (entry) => entry.status !== 'D' && !entry.binary;

// Comments are blanked (newlines kept) so no check fires on prose.
const blank = (text) => text.replace(/[^\n]/g, ' ');
const maskComments = (file, content) => {
  if (/\.(s?css)$/.test(file)) {
    const masked = content.replace(/\/\*[\s\S]*?\*\//g, blank);
    return file.endsWith('.scss') ? masked.replace(/(^|[^:"'])(\/\/[^\n]*)/gm, (_, lead, comment) => lead + blank(comment)) : masked;
  }
  if (/\.(ts|mjs|js)$/.test(file)) {
    return content.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^(\s*)(\/\/[^\n]*)/gm, (_, lead, comment) => lead + blank(comment));
  }
  if (file.endsWith('.html')) return content.replace(/<!--[\s\S]*?-->/g, blank);
  return content;
};
const maskedCache = new Map();
const maskedLinesOf = (file) => {
  if (!maskedCache.has(file)) maskedCache.set(file, maskComments(file, readTree(file) ?? '').split(/\r?\n/));
  return maskedCache.get(file);
};
/** The added lines of a file: `text` as written, `code` with comments blanked. */
const addedLinesOf = (file) => {
  const entry = files.get(file);
  const content = readTree(file);
  if (!entry || !content) return [];
  const lines = content.split(/\r?\n/);
  const masked = maskedLinesOf(file);
  return [...entry.addedLines]
    .sort((a, b) => a - b)
    .map((number) => ({ number, text: lines[number - 1] ?? '', code: masked[number - 1] ?? '' }));
};
/** The selector of the CSS block that holds this line. */
const selectorAt = (lines, index) => {
  let depth = 0;
  for (let line = index - 1; line >= 0; line--) {
    for (let char = lines[line].length - 1; char >= 0; char--) {
      if (lines[line][char] === '}') depth++;
      else if (lines[line][char] === '{' && depth-- === 0) return lines[line].slice(0, char).trim() || (lines[line - 1] ?? '').trim();
    }
  }
  return '';
};
const lineOf = (content, index) => content.slice(0, index).split('\n').length;
/** The whole opening tag that starts on this line (Ionic tags often wrap), up to its closing `>`. */
const openingTag = (lines, index, tag) => {
  let text = lines[index].slice(lines[index].indexOf(`<${tag}`));
  for (let next = index + 1; !/>/.test(text.replace(/"[^"]*"/g, '""')) && next < lines.length && next < index + 25; next++) {
    text += `\n${lines[next]}`;
  }
  return text.replace(/"[^"]*"/g, (quoted) => quoted.replace(/>/g, '›')).replace(/>[\s\S]*$/, '>');
};

// --- translations ---

const flatten = (object, prefix = '', result = {}) => {
  for (const [key, value] of Object.entries(object ?? {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, result);
    else result[full] = value;
  }
  return result;
};

/** The argument names and the plural/select branches of an ICU message. Throws on broken syntax. */
const parseIcu = (message) => {
  const text = String(message);
  const argNames = new Set();
  const branches = [];
  let index = 0;
  const readText = (depth) => {
    while (index < text.length) {
      const char = text[index];
      if (char === "'") {
        // ICU quoting: '' is an apostrophe, '{…}' is literal text.
        if (text[index + 1] === "'") index += 2;
        else if ('{}#'.includes(text[index + 1] ?? '')) {
          const end = text.indexOf("'", index + 1);
          index = end < 0 ? text.length : end + 1;
        } else index++;
        continue;
      }
      if (char === '{') {
        index++;
        readArgument();
        continue;
      }
      if (char === '}') {
        if (depth > 0) return;
        throw new Error('a } with no matching {');
      }
      index++;
    }
    if (depth > 0) throw new Error('a { that is never closed');
  };
  const take = (pattern) => {
    const match = pattern.exec(text.slice(index));
    if (match) index += match[0].length;
    return match;
  };
  const readArgument = () => {
    const name = take(/^\s*([^\s,{}]+)\s*/);
    if (!name) throw new Error('an empty {}');
    argNames.add(name[1]);
    if (text[index] === '}') return void index++;
    if (text[index] !== ',') throw new Error(`{${name[1]} is not closed`);
    index++;
    const type = take(/^\s*(\w+)\s*/);
    if (!type) throw new Error(`{${name[1]}, has no type`);
    if (text[index] === '}') return void index++;
    if (text[index] !== ',') throw new Error(`{${name[1]}, ${type[1]} is not closed`);
    index++;
    if (!['plural', 'select', 'selectordinal'].includes(type[1])) {
      // number / date / time with a style: skip to the matching brace.
      for (let depth = 1; depth; index++) {
        if (index >= text.length) throw new Error(`{${name[1]}, ${type[1]} is not closed`);
        if (text[index] === '{') depth++;
        else if (text[index] === '}') depth--;
      }
      return;
    }
    const categories = [];
    for (;;) {
      take(/^\s*/);
      if (text[index] === '}') {
        index++;
        break;
      }
      if (take(/^offset:\s*\d+\s*/)) continue;
      const selector = take(/^([^\s{}]+)\s*/);
      if (!selector || text[index] !== '{') throw new Error(`a ${type[1]} branch in {${name[1]} has no {message}`);
      index++;
      categories.push(selector[1]);
      readText(1);
      index++;
    }
    branches.push({ name: name[1], type: type[1], categories });
  };
  readText(0);
  return { argNames, branches };
};
const safeParse = (message) => {
  try {
    return { ...parseIcu(message), error: null };
  } catch (error) {
    return { argNames: new Set(), branches: [], error: error.message };
  }
};

const loadMaps = (read) => {
  const maps = {};
  const invalid = [];
  for (const [set, langs] of Object.entries(I18N)) {
    maps[set] = {};
    for (const [lang, file] of Object.entries(langs)) {
      const text = read(file);
      try {
        maps[set][lang] = text ? flatten(JSON.parse(text)) : {};
      } catch (error) {
        maps[set][lang] = {};
        invalid.push(`${file}: not valid JSON (${error.message}), so every key in it shows as the raw key`);
      }
    }
  }
  return { maps, invalid };
};
const { maps: now, invalid: invalidJson } = loadMaps(readTree);
const { maps: before } = loadMaps(baseContent);

const i18nProblems = [...invalidJson];
// CLDR categories: cardinal for `plural`, ordinal for `selectordinal` (1st, 2nd, 3rd, 4th in English; ro has one / other).
const PLURAL_CATEGORIES = {
  plural: { en: new Set(['one', 'other']), ro: new Set(['one', 'few', 'other']) },
  selectordinal: { en: new Set(['one', 'two', 'few', 'other']), ro: new Set(['one', 'other']) },
};
for (const [set, langs] of Object.entries(I18N)) {
  // Parity: only what this change broke.
  for (const [lang, other] of [['en', 'ro'], ['ro', 'en']]) {
    const missing = (maps) => Object.keys(maps[set][lang]).filter((key) => !(key in maps[set][other]));
    const missingBefore = new Set(missing(before));
    for (const key of missing(now)) {
      if (!missingBefore.has(key)) i18nProblems.push(`${langs[other]}: \`${key}\` is in ${lang} but not in ${other}`);
    }
  }
  // Every new or reworded message.
  for (const lang of ['en', 'ro']) {
    for (const [key, value] of Object.entries(now[set][lang])) {
      if (before[set][lang][key] === value) continue;
      const where = `${langs[lang]}: \`${key}\``;
      if (typeof value !== 'string') {
        i18nProblems.push(`${where} is not a string, so it renders as garbage`);
        continue;
      }
      const parsed = safeParse(value);
      if (parsed.error) {
        i18nProblems.push(`${where} is not valid ICU (${parsed.error}), so the message fails to render`);
        continue;
      }
      for (const branch of parsed.branches.filter((item) => item.type !== 'select')) {
        const named = branch.categories.filter((category) => !category.startsWith('='));
        const foreign = named.filter((category) => !PLURAL_CATEGORIES[branch.type][lang].has(category));
        if (foreign.length) i18nProblems.push(`${where} uses ${branch.type} categories ${lang} doesn't have: ${foreign.join(', ')}`);
        if (!named.includes('other')) i18nProblems.push(`${where} has a ${branch.type} with no \`other\` branch`);
        if (branch.type === 'plural' && lang === 'ro' && !named.includes('few')) {
          i18nProblems.push(`${where} has a plural with no \`few\` branch, so 2 to 19 read with the \`other\` form ("de")`);
        }
      }
      const sibling = now[set][lang === 'en' ? 'ro' : 'en'][key];
      if (lang === 'en' && typeof sibling === 'string') {
        const siblingArgs = safeParse(sibling).argNames;
        const onlyEn = [...parsed.argNames].filter((name) => !siblingArgs.has(name));
        const onlyRo = [...siblingArgs].filter((name) => !parsed.argNames.has(name));
        if (onlyEn.length || onlyRo.length) {
          i18nProblems.push(
            `${where}: en and ro take different params (en only: ${onlyEn.join(', ') || 'none'}; ro only: ${onlyRo.join(', ') || 'none'})`,
          );
        }
      }
      if (/\s[-\u2013\u2014]\s|[\u2013\u2014]/.test(value.replace(/\{[^{}]*\}/g, ''))) {
        i18nProblems.push(`${where} uses a dash as punctuation (CLAUDE.md "Two languages, always")`);
      }
      if (/<\/?[a-z][\w-]*[\s>/]/i.test(value)) i18nProblems.push(`${where} contains HTML (CLAUDE.md: no HTML in JSON, split the keys)`);
    }
  }
}
// An app file must never redefine a shared namespace.
const sharedTop = new Set(Object.keys(now.core.en).map((key) => key.split('.')[0]));
const sharedTopBefore = new Set(Object.keys(before.core.en).map((key) => key.split('.')[0]));
for (const top of new Set(Object.keys(now.mobile.en).map((key) => key.split('.')[0]))) {
  const clashedBefore = Object.keys(before.mobile.en).some((key) => key.split('.')[0] === top) && sharedTopBefore.has(top);
  if (sharedTop.has(top) && !clashedBefore) i18nProblems.push(`${I18N.mobile.en}: top-level \`${top}\` redefines a shared namespace`);
}

const knownFor = (file) => (file.startsWith('projects/core/') ? [now.core.en] : [now.mobile.en, now.core.en]);
const lookup = (file, key) => knownFor(file).find((map) => key in map)?.[key];
const isNamespace = (file, key) => knownFor(file).some((map) => !(key in map) && Object.keys(map).some((leaf) => leaf.startsWith(`${key}.`)));
const topLevel = new Set([...Object.keys(now.mobile.en), ...Object.keys(now.core.en)].map((key) => key.split('.')[0]));
const paramNames = (objectLiteral) =>
  objectLiteral
    .split(',')
    .map((part) => /^\s*['"]?(\w+)/.exec(part)?.[1])
    .filter(Boolean);

const missingKeys = [];
const missingParams = [];
const coreKeyOnlyInApp = [];
for (const [file, entry] of files) {
  if (!live(entry) || !/^projects\/(mobile|core)\/src\/.*\.(html|ts)$/.test(file) || file.endsWith('.spec.ts')) continue;
  for (const { number, code: text } of addedLinesOf(file)) {
    const uses = file.endsWith('.html')
      ? [...text.matchAll(/'([\w.-]+)'\s*\|\s*translate\b(\s*:\s*(\{[^}]*\})?)?/g)].map((match) => ({
          key: match[1],
          hasParams: Boolean(match[2]),
          params: match[3]?.slice(1, -1),
          sure: true,
        }))
      : [
          ...[...text.matchAll(/(?:\.instant|\.stream|[tT]ranslate\w*\.get|(?<![\w.])translate)\(\s*['"`]([\w-]+(?:\.[\w-]+)+)['"`]\s*(\)|,\s*(\{[^}]*\})?)/g)].map((match) => ({
            key: match[1],
            hasParams: match[2] !== ')',
            params: match[3]?.slice(1, -1),
            sure: true,
          })),
          // Any other dotted literal under a real top-level namespace (validation overrides, config keys, ...).
          ...[...text.matchAll(/['"`]([a-z][\w-]*(?:\.[\w-]+)+)['"`]/g)].map((match) => ({ key: match[1], sure: false })),
        ];
    const seen = new Set();
    for (const { key, hasParams, params, sure } of uses) {
      if (seen.has(key) || key.endsWith('.')) continue;
      seen.add(key);
      if (!sure && (!topLevel.has(key.split('.')[0]) || /\.(enums?|model)\.ts$/.test(file) || /^(projects|src)\./.test(key))) continue;
      const value = lookup(file, key);
      if (value === undefined) {
        if (isNamespace(file, key)) {
          if (sure && file.endsWith('.html')) missingKeys.push(`${file}:${number}: \`${key}\` is a namespace, not a message: the pipe shows the raw key`);
        } else if (file.startsWith('projects/core/') && (key in now.mobile.en)) {
          coreKeyOnlyInApp.push(`${file}:${number}: \`${key}\` is only in the mobile file, but core code also runs in web`);
        } else {
          missingKeys.push(`${file}:${number}: \`${key}\` is not in ${file.startsWith('projects/core/') ? 'core' : 'mobile or core'} en.json${sure ? '' : ' (check: may not be a translation key)'}`);
        }
        continue;
      }
      if (!sure || typeof value !== 'string') continue;
      const expected = [...safeParse(value).argNames];
      if (!expected.length) continue;
      if (!hasParams) {
        missingParams.push(`${file}:${number}: \`${key}\` expects {${expected.join('}, {')}} but the call passes no params`);
      } else if (params !== undefined) {
        const passed = new Set(paramNames(params));
        const unfilled = expected.filter((name) => !passed.has(name));
        if (unfilled.length) missingParams.push(`${file}:${number}: \`${key}\` expects {${unfilled.join('}, {')}} but the call passes { ${[...passed].join(', ')} }`);
      }
    }
  }
}

const sourceFiles = git(['ls-files', '--cached', '--others', '--exclude-standard', '--', 'projects/*.ts', 'projects/*.html', 'projects/*.scss', 'projects/*.css'])
  .split(/\r?\n/)
  .filter((file) => file && !file.includes('/node_modules/') && exists(file));
const sources = new Map(sourceFiles.map((file) => [file, readTree(file)]));

// A removed key that some template or class still names shows as the raw key. Core keys are searched in web too.
const removedFrom = (set) => Object.keys(before[set].en).filter((key) => !(key in now.core.en) && !(key in now.mobile.en));
const removed = [...new Set([...removedFrom('core'), ...removedFrom('mobile')])];
const removedCore = new Set(removedFrom('core'));
const stillReferenced = [];
for (const [file, content] of removed.length ? sources : []) {
  if (!/\.(ts|html)$/.test(file) || file.endsWith('.spec.ts')) continue;
  const inScope = /^projects\/(mobile|core)\//.test(file);
  for (const key of removed) {
    if (!inScope && !removedCore.has(key)) continue;
    const index = content.search(new RegExp(`["'\`]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`]`));
    if (index >= 0) stillReferenced.push(`${file}:${lineOf(content, index)}: \`${key}\` was removed but is still used here`);
  }
}

// --- broken links: a worktree is never compiled ---

const brokenLinks = [];
const resolveRelative = (from, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
for (const [file, content] of sources) {
  if (!/^projects\/(mobile|core)\//.test(file)) continue;
  const lines = content.split('\n');
  const report = (spec, index, candidates) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(lines[lineOf(content, index) - 1] ?? '')) return;
    if (!candidates.some(exists)) brokenLinks.push(`${file}:${lineOf(content, index)}: \`${spec}\` does not exist at head, so the build fails`);
  };
  if (file.endsWith('.ts')) {
    for (const match of content.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.[^"']*)["']/g)) {
      const target = resolveRelative(file, match[1]);
      report(match[1], match.index, [target, `${target}.ts`, `${target}/index.ts`, `${target}.mjs`, `${target}.js`]);
    }
    for (const match of content.matchAll(/(?:templateUrl|styleUrls?)\s*:\s*\[?([^\]\n]*)/g)) {
      for (const url of match[1].matchAll(/["']([^"']+)["']/g)) report(url[1], match.index, [resolveRelative(file, url[1])]);
    }
  } else if (/\.(s?css)$/.test(file)) {
    for (const match of content.matchAll(/@(?:use|import|forward)\s+(?:url\()?["'](\.[^"']+)["']/g)) {
      const target = resolveRelative(file, match[1]);
      const dir = path.posix.dirname(target);
      const name = path.posix.basename(target);
      report(match[1], match.index, [target, `${target}.scss`, `${target}.css`, `${dir}/_${name}.scss`, `${dir}/_${name}`, `${target}/_index.scss`]);
    }
  }
}

// --- specs (every change ships with its specs) ---

// Code a spec can cover: a component, service, store or module of functions.
// Routes, models, enums, environments and bootstrap files carry no logic.
const NO_SPEC_NEEDED = /(\.routes|\.model|\.enums|\.d|^main|app\.config|test-setup)\.ts$|\/environments\//;
// A line that changes behaviour: not blank, not a comment, not an import.
const isCodeLine = (text) => {
  const line = text.trim();
  return line !== '' && !/^(\/\/|\/\*|\*|import\b|\} from\b)/.test(line);
};

const specFacts = [];
for (const [file, entry] of files) {
  if (!live(entry) || !file.startsWith('projects/mobile/src/') || !/\.ts$/.test(file)) continue;
  if (file.endsWith('.spec.ts') || NO_SPEC_NEEDED.test(path.posix.basename(file)) || NO_SPEC_NEEDED.test(file)) continue;
  if (!addedLinesOf(file).some(({ text }) => isCodeLine(text))) continue;
  const spec = file.replace(/\.ts$/, '.spec.ts');
  const specTouched = files.has(spec) && live(files.get(spec));
  if (specTouched) continue;
  const where = exists(spec) ? `\`${path.posix.basename(spec)}\` is untouched` : `there is no \`${path.posix.basename(spec)}\``;
  specFacts.push(`${file}: code changed and ${where}`);
}

// --- icons on added template lines (icons.md) ---

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
const relativeImports = (file, content) =>
  [...(content ?? '').matchAll(/from\s+["'](\.[^"']+)["']/g)].map((match) => `${resolveRelative(file, match[1])}.ts`).filter(exists);
const iconFacts = [];
for (const [file, entry] of files) {
  if (!live(entry) || !/^projects\/mobile\/src\/.*\.html$/.test(file)) continue;
  const component = file.replace(/\.html$/, '.ts');
  const componentSource = readTree(component);
  // A feature's `*.icons.ts` registry (HOME_ICONS, GROUPS_ICONS) is registered by its pages for every child component.
  const featureRegistries = [];
  for (let dir = path.posix.dirname(component); dir.startsWith('projects/mobile/src/app'); dir = path.posix.dirname(dir)) {
    const listing = fs.readdirSync(path.join(tree, dir), { withFileTypes: true });
    featureRegistries.push(...listing.filter((item) => item.isFile() && item.name.endsWith('.icons.ts')).map((item) => `${dir}/${item.name}`));
  }
  const registries = [component, ...relativeImports(component, componentSource), ...featureRegistries, 'projects/mobile/src/app/app.ts'];
  const registered = registries.map(readTree).filter(Boolean).join('\n');
  const lines = maskedLinesOf(file);
  for (const { number, code: text } of addedLinesOf(file)) {
    // A static `name` on an ion-icon (its tag may wrap), or an ionicon passed by attribute to any element.
    const names = [
      ...(/<ion-icon\b/.test(text) ? [.../(?<![\w[.-])name="([a-z][a-z0-9-]*)"/.exec(openingTag(lines, number - 1, 'ion-icon'))?.slice(1, 2) ?? []] : []),
      ...[...text.matchAll(/(?<![\w[.-])(?:icon|searchIcon|clearIcon|toggleIcon|backButtonIcon)="([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"/g)].map((match) => match[1]),
    ];
    for (const name of new Set(names)) {
      const where = `${file}:${number}: \`${name}\``;
      if (!/-outline$/.test(name) && !/^logo-/.test(name) && !['thumbs-up', 'checkmark-circle'].includes(name)) {
        iconFacts.push(`${where} is a filled glyph; icons are outline only, outside the state pairs (icons.md, "Outline, always")`);
      }
      if (['people-circle-outline', 'person-circle-outline'].includes(name)) iconFacts.push(`${where} is a filled glyph despite its name (icons.md)`);
      if (/^arrow-(?!undo)/.test(name)) iconFacts.push(`${where}: direction is a chevron, never an arrow (icons.md, "One stroke weight")`);
      if (!new RegExp(`\\b${camel(name)}\\b`).test(registered)) {
        iconFacts.push(`${where} is not registered with addIcons() in ${path.posix.basename(component)}, the files it imports, or app.ts (check: it renders blank unless another loaded screen registered it)`);
      }
    }
  }
}

// --- convention hits and risky patterns on added lines ---

const MOBILE_THEME_TOKENS = 'projects/mobile/src/theme/variables.css';
const isMobile = (file) => file.startsWith('projects/mobile/src/');
const isStyle = (file) => /\.(s?css)$/.test(file);
const isTemplate = (file) => file.endsWith('.html');
const isScript = (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts');
const stripComment = (text) => text.replace(/\/\*.*?\*\/|\/\/.*$/g, '');

/** [applies(file), test(text, context) → message | null] */
const CONVENTIONS = [
  // Angular, every reviewed project.
  [isScript, (text) => /standalone:\s*true/.test(text) && 'remove `standalone: true` (the default)'],
  [isScript, (text) => /ChangeDetectionStrategy\.OnPush/.test(text) && 'remove the explicit `OnPush` (the default in v22)'],
  [isScript, (text) => /@(Input|Output|ViewChild|ViewChildren|ContentChild|HostBinding|HostListener)\(/.test(text) && 'decorator API: use `input()` / `output()` / `model()` / `viewChild()` / `host`'],
  [isScript, (text) => /constructor\s*\(\s*(private|public|protected|readonly)\b/.test(text) && 'constructor injection: use `inject()`'],
  [isScript, (text) => /(:\s*any\b|<any>|\bas any\b)/.test(stripComment(text)) && '`any`: use a real type or `unknown`'],
  [isScript, (text) => /\.mutate\(/.test(text) && '`mutate` on a signal: use `set` / `update`'],
  [isScript, (text) => /private\s+(?!readonly)_?\w+\s*=\s*inject\(/.test(text) && 'an injected dependency must be `private readonly _name`'],
  [isScript, (text) => /private\s+readonly\s+(?!_)\w+\s*=\s*inject\(/.test(text) && 'an injected dependency takes the `_` prefix'],
  [isScript, (text) => /providedIn:\s*['"]root['"]/.test(text) && 'new singleton services use `@Service()` (CLAUDE.md, "Angular-Specific Rules")'],
  [(file) => isScript(file) || isTemplate(file), (text) => /[!=]==?\s*['"][A-Z][A-Z0-9_]{2,}['"]|['"][A-Z][A-Z0-9_]{2,}['"]\s*[!=]==?/.test(text) && 'an enum compared with a string literal: expose the const object as a readonly member (check: may be an HTTP verb or a currency)'],
  [(file) => isScript(file) || isTemplate(file), (text) => /[!=]==?\s*1\s*\?\s*['"`]/.test(text) && 'a hand-rolled plural: use an ICU `plural` message'],
  [isScript, (text) => /toLocale\w*String\(\s*(undefined|['"](en|ro)\b)|Intl\.\w+\(\s*(undefined|['"](en|ro)\b)/.test(text) && 'a literal or `undefined` locale: use `appLocale()` from core'],
  [isTemplate, (text) => /\*ng(If|For|Switch)\b|\[ng(Class|Style)\]/.test(text) && 'legacy directive: use `@if` / `@for` / `@switch` and `class` / `style` bindings'],
  [isTemplate, (text) => /\[innerHTML\]/.test(text) && '`[innerHTML]`: check the content cannot carry user text'],

  // Mobile TS.
  [(file) => isMobile(file) && isScript(file), (text) => /from\s+['"]@ionic\/angular['"]|IonicModule/.test(text) && 'import Ionic pieces one by one from `@ionic/angular/standalone`'],
  [(file) => isMobile(file) && isScript(file), (text) => /from\s+['"]primeng/.test(text) && 'PrimeNG is banned in mobile'],
  [(file) => isMobile(file) && isScript(file), (text) => /\bActionSheetController\b/.test(text) && 'sheets are built on `mh-sheet-shell` / `mh-action-sheet`, never `ActionSheetController` (surfaces-and-sheets.md)'],
  [(file) => isMobile(file) && isScript(file), (text) => /\b(filterClients|filterPendingRequests)\(/.test(text) && 'PrimeNG-shaped core call: use `getClients()` / `getPendingRequests()` (mobile CLAUDE.md, "Core reuse contract")'],
  [(file) => isMobile(file) && isScript(file), (text) => /import\s*\{[^}]*\b(ThemeService|GoogleAuthService|FacebookAuthService|StripeIframeDirective)\b[^}]*\}\s*from\s*['"]core['"]/.test(text) && 'a core piece mobile must not import (mobile CLAUDE.md, "Core reuse contract")'],

  // Mobile templates.
  [(file) => isMobile(file) && isTemplate(file), (text) => (/<(button|input|select|textarea)\b/.test(text) || /<a\b[^>]*\(click\)/.test(text)) && 'a native interactive element: use the Ionic one (check: plain buttons are allowed only for grid controls such as the keypad)'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /<ion-chip\b[^>]*\(click\)/.test(text) && '`ion-chip` with `(click)` has no role and no tab stop: use `<ion-button class="chip" …>`'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /\bion-text-uppercase\b/.test(text) && 'no uppercase: kickers and labels are sentence case (colour-and-type.md, "Type")'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /\bion-no-border\b/.test(text) && 'bars already have no edge; don\'t add `ion-no-border` (surfaces-and-sheets.md)'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /<ion-(item|list)\b[^>]*\slines=/.test(text) && '`lines` on a row or list: the skin draws the separators (lists.md)'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /<ion-modal\b/.test(text) && 'a bare `ion-modal`: sheets are built on `mh-sheet-shell` (surfaces-and-sheets.md)'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /<ion-icon\b[^>]*\ssize="(small|large)"/.test(text) && '`size` on `ion-icon`: use a `--mh-icon-*` token (icons.md, "Sizes")'],
  [(file) => isMobile(file) && isTemplate(file), (text) => /\s(aria-label|placeholder|label|title|header|text|helperText|errorText)="[A-Z][a-z]+[^"]*"/.test(text) && 'a literal user-visible attribute: translate it (check)'],
  [(file) => isMobile(file) && isTemplate(file), (text) => />\s*[A-Z][a-z]+(\s+[a-z]+)+[.!?]?\s*</.test(text) && 'a literal text node: translate it (check)'],
  [(file) => isMobile(file) && isTemplate(file), (text, { tag }) => tag('ion-searchbar', (open) => !/\bmhAutofocus\b/.test(open) && 'an `ion-searchbar` without `mhAutofocus` (check: fine only when it is always on screen; ionic-gotchas.md)')],
  [(file) => isMobile(file) && isTemplate(file), (text, { tag }) => tag('ion-searchbar', (open) => !(/searchIcon=/.test(open) && /clearIcon=/.test(open)) && 'an `ion-searchbar` without `searchIcon="search-outline" clearIcon="close-outline"` (icons.md)')],
  [(file) => isMobile(file) && isTemplate(file), (text, { tag }) => tag('ion-select', (open) => !/toggleIcon=/.test(open) && 'an `ion-select` without `toggleIcon="chevron-down-outline"` (icons.md)')],
  [(file) => isMobile(file) && isTemplate(file), (text, { tag }) => tag('ion-back-button', (open) => !/aria-label/.test(open) && 'an `ion-back-button` without `[attr.aria-label]="\'a11y.back\' | translate"`: it is announced as the English "back" (ionic-gotchas.md)')],

  // Mobile styles.
  [(file) => isMobile(file) && isStyle(file) && file !== MOBILE_THEME_TOKENS, (text) => /#[0-9a-fA-F]{3,8}\b/.test(text) && 'a hex colour: read a token (mobile CLAUDE.md, "CSS variable standard")'],
  [(file) => isMobile(file) && isStyle(file) && file !== MOBILE_THEME_TOKENS, (text) => /\b(rgba?|hsla?)\(\s*\d/.test(text) && 'a literal colour: read a token'],
  [(file) => isMobile(file) && isStyle(file), (text) => /font-size\s*:(?!\s*(var\(--mh-(text|icon)-|inherit|unset|initial|revert))/.test(text) && '`font-size` must be a `--mh-text-*` (text) or `--mh-icon-*` (icon) token'],
  [(file) => isMobile(file) && isStyle(file) && file !== MOBILE_THEME_TOKENS, (text) => /(?<!var\(--[\w-]+,\s*)\b\d*\.?\d+px\b/.test(text) && 'px is for border widths only, and those are tokens (`--mh-hairline`, `--mh-ring-width`, `--mh-spine-width`)'],
  [(file) => isMobile(file) && isStyle(file), (text) => {
    const offGrid = [...text.matchAll(/(?<![\w.])-?(\d*\.?\d+)rem\b/g)].map((match) => match[1]).filter((value) => Math.abs(Number(value) * 8 - Math.round(Number(value) * 8)) > 1e-9);
    return offGrid.length > 0 && !/clamp\(/.test(text) && `off the 0.125rem grid: ${offGrid.map((value) => `${value}rem`).join(', ')}`;
  }],
  [(file) => isMobile(file) && isStyle(file), (text) => /(?<![\w.-])\d*\.?\d+vh\b/.test(text) && '`vh` beside the keyboard or the WebView chrome: use `dvh`'],
  [(file) => isMobile(file) && isStyle(file), (text) => /line-height\s*:(?!\s*(var\(--mh-leading-|0\s*(;|$)|inherit|normal|unset))/.test(text) && '`line-height` comes from a `--mh-leading-*` token'],
  [(file) => isMobile(file) && isStyle(file), (text) => /letter-spacing\s*:(?!\s*(var\(--mh-tracking-|0\s*(;|$)|normal|inherit|unset))/.test(text) && '`letter-spacing` comes from `--mh-tracking-kicker`'],
  [(file) => isMobile(file) && isStyle(file), (text) => /text-transform\s*:\s*uppercase/.test(text) && 'no uppercase (colour-and-type.md, "Type")'],
  [(file) => isMobile(file) && isStyle(file) && !file.endsWith('ion-icon.css'), (text) => /--ionicon-stroke-width\s*:/.test(text) && 'the stroke is set once in `ion-icon.css` (icons.md)'],
  [(file) => isMobile(file) && isStyle(file) && file !== MOBILE_THEME_TOKENS, (text) => /var\(--mh-(primary|warning|success|info|danger|violet|navy|slate|teal|coral)-\d{2,3}\)/.test(text) && 'a ramp step read outside `variables.css`: mint a role token (mobile CLAUDE.md, tier 3)'],
  [(file) => file.startsWith('projects/mobile/src/theme/components/'), (text, { selector }) => /\bmargin(-\w+)?\s*:(?!\s*(0\s*(;|$)|auto))/.test(text) && /^(ion-[\w-]+|mh-[\w-]+|\.mh-[\w-]+)(\s*,\s*(ion-[\w-]+|mh-[\w-]+|\.mh-[\w-]+))*$/.test(selector()) && 'a placement margin on a component\'s host in its skin: skins are margin-free, pages place them (mobile CLAUDE.md, "Layout rule")'],
  [(file) => isMobile(file) && isStyle(file) && !file.startsWith('projects/mobile/src/theme/'), (text, { selector }) => /--(padding-(start|end|top|bottom)|inner-padding-end|min-height|border-(width|style|color))\s*:/.test(text) && /\bion-item\b/.test(selector()) && 'insets, height or border set on an `ion-item` outside the skin: list rows set none of these (lists.md; check it is not a list row)'],
];

const RISKY = [
  [isScript, (text) => /toISOString\(\)\s*\.(slice|substring|substr)\(\s*0\s*,\s*10\s*\)|toISOString\(\)\.split\(\s*['"]T['"]\s*\)/.test(text) && 'a day key from `toISOString()`: a local date shifts back a day in Romania (UTC+2/+3); core has `localDayKey()`'],
  [isScript, (text) => /new Date\(\s*['"`]\d{4}-\d{2}-\d{2}['"`]\s*\)/.test(text) && '`new Date("YYYY-MM-DD")` parses as UTC midnight, not the local day; core has `dayFromKey()`'],
  [isStyle, (text) => /rgba?\(\s*var\(--[\w-]+-rgb\)\s*\//.test(text) && '`rgb(var(--x-rgb) / a)` is invalid with a comma triplet and paints nothing: write `rgba(var(--x-rgb), a)`'],
  [(file) => isMobile(file) && isScript(file), (text) => /addEventListener\(\s*['"]pointerdown['"]/.test(text) && '`pointerdown` cancelled on a touch drops the click in WebKit; keep focus with `mousedown` (ionic-gotchas.md)'],
  [(file) => isMobile(file) && isScript(file), (text) => /\b(localStorage|sessionStorage)\./.test(text) && 'web storage in the native app: check whether it must survive the OS clearing the WebView (Preferences)'],
  [(file) => isMobile(file) && isScript(file), (text) => /window\.open\(/.test(text) && '`window.open` in the WebView: check it goes through the in-app browser or `AppLinkService`'],
];

const conventionHits = [];
const riskyHits = [];
for (const [file, entry] of files) {
  if (!live(entry) || !REVIEWED.has(scopeOf(file)) || !/^projects\//.test(file) || isI18n(file) || file.endsWith('.spec.ts')) continue;
  if (!readTree(file)) continue;
  const lines = maskedLinesOf(file);
  for (const { number, code: text } of addedLinesOf(file)) {
    if (!text.trim()) continue;
    const context = {
      tag: (name, check) => (new RegExp(`<${name}\\b`).test(text) ? check(openingTag(lines, number - 1, name)) : null),
      selector: () => selectorAt(lines, number - 1),
    };
    for (const [applies, test] of CONVENTIONS) {
      if (!applies(file)) continue;
      const message = test(text, context);
      if (message) conventionHits.push(`${file}:${number}: ${message}`);
    }
    for (const [applies, test] of RISKY) {
      if (!applies(file)) continue;
      const message = test(text, context);
      if (message) riskyHits.push(`${file}:${number}: ${message}`);
    }
  }
}

// --- role tokens read on added lines but defined nowhere: the property silently falls back ---

const TOKEN = /--(?:mh-[\w-]+|ion-color-[\w-]+-(?:wash|tile)[\w-]*)/;
const definedTokens = new Set();
for (const [file, content] of sources) {
  if (!file.startsWith('projects/mobile/')) continue;
  const masked = maskComments(file, content);
  const definition = /\.(s?css)$/.test(file)
    ? new RegExp(`(${TOKEN.source})\\s*:`, 'g')
    : new RegExp(`(?:style\\.|setProperty\\(\\s*['"\`]|['"\`])(${TOKEN.source})`, 'g');
  for (const match of masked.matchAll(definition)) definedTokens.add(match[1]);
}
const undefinedTokens = [];
for (const [file, entry] of files) {
  if (!live(entry) || !/^projects\/mobile\/src\/.*\.(s?css|html|ts)$/.test(file) || file.endsWith('.spec.ts')) continue;
  for (const { number, code } of addedLinesOf(file)) {
    for (const match of code.matchAll(new RegExp(`var\\(\\s*(${TOKEN.source})\\s*(,)?`, 'g'))) {
      if (definedTokens.has(match[1])) continue;
      undefinedTokens.push(`${file}:${number}: \`${match[1]}\` is defined nowhere in mobile${match[2] ? ', so only its fallback ever applies' : ', so the property silently falls back'}`);
    }
  }
}

// --- native: a plugin added to package.json but never synced into the native projects ---

const nativeFacts = [];
const dependencies = (text) => {
  try {
    const json = JSON.parse(text ?? '{}');
    return { ...json.dependencies, ...json.devDependencies };
  } catch {
    return {};
  }
};
const isPlugin = (name) => /^(@capacitor\/(?!core$|cli$|android$|ios$|assets$)|@capacitor-community\/|@capacitor-firebase\/|@capgo\/|@capawesome\/|capacitor-)/.test(name);
const depsNow = dependencies(readTree('package.json'));
const depsBefore = dependencies(baseContent('package.json'));
const androidSettings = readTree('android/capacitor.settings.gradle') ?? '';
const iosPackage = readTree('ios/App/CapApp-SPM/Package.swift') ?? '';
for (const name of Object.keys(depsNow).filter(isPlugin)) {
  if (depsBefore[name] === depsNow[name]) continue;
  const change = depsBefore[name] ? `${depsBefore[name]} → ${depsNow[name]}` : `added at ${depsNow[name]}`;
  const missing = [
    !androidSettings.includes(`node_modules/${name}/`) && 'android/capacitor.settings.gradle',
    !iosPackage.includes(`node_modules/${name}`) && 'ios/App/CapApp-SPM/Package.swift',
  ].filter(Boolean);
  nativeFacts.push(
    missing.length
      ? `package.json: \`${name}\` ${change}, but ${missing.join(' and ')} don't list it: \`npm run cap:sync\` wasn't run, so the native app has no implementation (check: a web-only plugin needs none)`
      : `package.json: \`${name}\` ${change} (native projects list it; a major bump may still need a native change)`,
  );
}
for (const name of Object.keys(depsBefore).filter((dep) => isPlugin(dep) && !(dep in depsNow))) {
  if (androidSettings.includes(`node_modules/${name}/`) || iosPackage.includes(`node_modules/${name}`)) {
    nativeFacts.push(`package.json: \`${name}\` was removed but the native projects still reference it, so the native build fails until \`npm run cap:sync\``);
  }
}

// --- pointers for the reviewers ---

const changed = [...files.entries()].filter(([, entry]) => entry.status !== 'D').map(([file]) => file);
const reviewedChanged = changed.filter((file) => REVIEWED.has(scopeOf(file)));
const addedText = (file) => addedLinesOf(file).map(({ text }) => text).join('\n');
const contractFiles = reviewedChanged.filter(
  (file) =>
    /^projects\/core\/src\/lib\/(models|services|stores|constants\/api-endpoints)/.test(file) ||
    (/\.ts$/.test(file) && /\b(HttpClient|this\._http\b|httpResource|API_ENDPOINTS)\b/.test(addedText(file))),
);
const securityFiles = reviewedChanged.filter(
  (file) =>
    /(guard|interceptor|auth|login|token|ticket|sanitiz|upload|photo|share|app-link|deep-link|push|capacitor\.config|AndroidManifest|Info\.plist|\.entitlements|network_security)/i.test(path.posix.basename(file)) ||
    /(innerHTML|bypassSecurityTrust|DomSanitizer|window\.open|localStorage|sessionStorage|Preferences\.|SecureStorage|\beval\(|new Function\()/.test(addedText(file)),
);
const sharedFiles = reviewedChanged.filter((file) => /^projects\/(core\/|mobile\/src\/(app\/_shared\/|theme\/|app\/app\.(ts|config\.ts|routes\.ts)|styles\.css))/.test(file));
const nativeFiles = reviewedChanged.filter((file) => scopeOf(file) === 'native');
const visualFiles = reviewedChanged.filter((file) => /^projects\/mobile\/src\/.*\.(html|scss|css)$/.test(file));
const screenOf = (file) => {
  const feature = /^projects\/mobile\/src\/app\/(?:main|pages|layouts)\/([^/]+)/.exec(file);
  if (feature) return feature[1];
  const shared = /^projects\/mobile\/src\/app\/_shared\/components\/([^/]+)/.exec(file);
  if (shared) return `${shared[1]} (shared: every screen that uses it)`;
  return 'theme (every screen)';
};
const screens = [...new Set(visualFiles.map(screenOf))];
const outsideFiles = changed.filter((file) => scopeOf(file) === 'outside' || OUTSIDE_I18N.test(file));

// --- size and depth ---

const entries = [...files.entries()];
const code = entries.filter(([file]) => REVIEWED.has(scopeOf(file)) && isCode(file));
// Deleting a whole file is reviewed by asking who still uses it (reviewer C), so it doesn't drive the depth.
const kept = code.filter(([, entry]) => entry.status !== 'D');
const codeLines = kept.reduce((total, [, entry]) => total + entry.added + entry.deleted, 0);
const i18n = entries.filter(([file]) => isI18n(file));
const outside = entries.filter(([file]) => scopeOf(file) === 'outside');
const other = entries.filter(([file]) => !(REVIEWED.has(scopeOf(file)) && isCode(file)) && !isI18n(file) && scopeOf(file) !== 'outside');
const depth =
  code.length === 0 && i18n.length === 0
    ? 'none'
    : codeLines <= 150 && kept.length <= 6
      ? 'light'
      : codeLines > 1000 || kept.length > 30
        ? 'deep'
        : 'standard';

const head = git(['rev-parse', '--short', 'HEAD']).trim();
const dirty = git(['status', '--porcelain', '--', '.']).trim().length > 0;
const headLabel = `${head}${dirty ? ' + uncommitted changes' : ''}`;

const list = (items, empty = 'none') => (items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`);
const sum = (rows, field) => rows.reduce((total, [, entry]) => total + entry[field], 0);
const fileRows = entries
  .sort(([a], [b]) => a.localeCompare(b))
  .map(
    ([file, entry]) =>
      `| ${entry.status}${entry.untracked ? ' (untracked)' : ''} | ${scopeOf(file)} | ${entry.oldPath ? `${entry.oldPath} → ` : ''}${file} | ${entry.binary ? 'bin' : entry.added} | ${entry.binary ? 'bin' : entry.deleted} |`,
  );

const facts = `# Review facts: ${base.slice(0, 9)}..${headLabel}

Written by \`.claude/skills/pr-review/scripts/diff-facts.mjs\`. Everything below is mechanical: it is certain unless marked "check",
so reviewers don't re-report it. Paths are relative to the tree under review; line numbers are the head's.

## Size

- Reviewed code (mobile, core, native, root config): ${kept.length} files changed or added, +${sum(kept, 'added')} −${sum(kept, 'deleted')}${code.length > kept.length ? `; ${code.length - kept.length} deleted (−${sum(code, 'deleted') - sum(kept, 'deleted')})` : ''}
- Translations (core + mobile): ${i18n.length ? `+${sum(i18n, 'added')} −${sum(i18n, 'deleted')} lines (see i18n.patch)` : 'unchanged'}
- Outside this review (web, website, admin): ${outside.length} files${outside.length ? ' (see outside.patch)' : ''}
- Other (docs, rules, .claude/, binary assets): ${other.length} files
- Suggested depth: **${depth}**

## Files

| Status | Scope | File | + | − |
|---|---|---|---|---|
${fileRows.join('\n')}

## Broken imports

${list(brokenLinks)}

## Specs

Every change ships with its specs: a changed component, service, store or function has a spec for what changed (testing-and-tooling.md, "Specs", user decision 2026-11-10). Each line is a "check": another spec in the diff may cover it, such as a helper's in \`*.config.spec.ts\` or \`logger-flow.spec.ts\`.

${list(specFacts)}

## Translations

Files (parity, ICU syntax, plural categories, params, dashes, HTML), new problems only:
${list(i18nProblems)}

Referenced but missing:
${list(missingKeys)}

Params the message expects but the call doesn't pass:
${list(missingParams)}

Core code using a key that only the mobile file defines:
${list(coreKeyOnlyInApp)}

Removed but still referenced:
${list(stillReferenced)}

## Icons on added template lines

${list(iconFacts)}

## Tokens read but defined nowhere

${list(undefinedTokens)}

## Convention hits on added lines

Regex checks of the mobile rules and CLAUDE.md. "check" means it may be a deliberate exception.

${list(conventionHits)}

## Risky patterns on added lines

Not findings by themselves: each is a place a reviewer should trace.

${list(riskyHits)}

## Native

${list(nativeFacts)}

## Pointers

- API contract (run \`api-contract-checker\` on these): ${contractFiles.join(', ') || 'nothing touched'}
- Security-sensitive code touched (suggest \`/claude-security\`, Scan changes): ${securityFiles.join(', ') || 'none'}
- Shared code changed (check every consumer; core is also used by web, website and admin): ${sharedFiles.join(', ') || 'none'}
- Native projects changed: ${nativeFiles.join(', ') || 'none'}
- Visual change, worth a \`/review-screen\` pass: ${screens.join(', ') || 'none'}
- Outside this review (web, website, admin; not hunted): ${outsideFiles.join(', ') || 'none'}
`;
fs.writeFileSync(path.join(out, 'facts.md'), facts);

console.log(
  JSON.stringify(
    {
      head: headLabel,
      depth,
      codeFiles: kept.length,
      deletedCodeFiles: code.length - kept.length,
      codeLines,
      i18nChanged: i18n.length > 0,
      outsideFiles: outside.length,
      otherFiles: other.length,
      factCounts: {
        brokenLinks: brokenLinks.length,
        specFacts: specFacts.length,
        i18nProblems: i18nProblems.length,
        missingKeys: missingKeys.length,
        missingParams: missingParams.length,
        coreKeyOnlyInApp: coreKeyOnlyInApp.length,
        stillReferenced: stillReferenced.length,
        iconFacts: iconFacts.length,
        undefinedTokens: undefinedTokens.length,
        conventionHits: conventionHits.length,
        riskyHits: riskyHits.length,
        nativeFacts: nativeFacts.length,
      },
      contractFiles,
      securityFiles,
      sharedFiles,
      nativeFiles,
      screens,
      outputs: ['facts.md', 'diff.patch', 'i18n.patch', 'outside.patch'].map((name) => path.join(out, name)),
    },
    null,
    2,
  ),
);
