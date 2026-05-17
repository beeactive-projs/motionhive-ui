#!/usr/bin/env node
/**
 * Reusability guardrail — enforces that "domain-agnostic" primitives
 * in `projects/core/src/lib/components/` never import session-domain
 * types.
 *
 * Runs in CI before `ng test`. Browser-side specs can't use `fs`/`path`,
 * so the check lives here as a Node-only script.
 *
 * Add to `package.json` scripts:
 *   "check:reusability": "node scripts/check-reusability.mjs",
 *   "test": "npm run check:reusability && ng test"
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(
  __dirname,
  '..',
  'projects',
  'core',
  'src',
  'lib',
  'components',
);

// Components allowed to import from `models/session/*` — the
// session-flavored chips and the session card. Everything else in
// `lib/components/` MUST stay domain-agnostic.
const ALLOWED = new Set([
  'access-chip',
  'type-chip',
  'provider-chip',
  'session-card',
  // Phase D: session-flavored editor + table primitives.
  // They live in core/lib/components/ because they're reused across the
  // instructor + client surfaces (form dialog, detail page, attendance,
  // approvals) — but they bind to session-domain types directly.
  'recurrence-builder',
  'participants-table',
]);

function listTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listTsFiles(p));
    else if (
      name.endsWith('.ts') &&
      !name.endsWith('.spec.ts') &&
      !name.endsWith('.model.ts')
    ) {
      out.push(p);
    }
  }
  return out;
}

const offenders = [];
for (const file of listTsFiles(COMPONENTS_DIR)) {
  const rel = file.replace(COMPONENTS_DIR + '/', '');
  const componentName = rel.split('/')[0].replace(/\.ts$/, '');
  if (ALLOWED.has(componentName)) continue;
  const src = readFileSync(file, 'utf-8');
  if (/from\s+['"][^'"]*models\/session\/[^'"]+['"]/.test(src)) {
    offenders.push(rel);
  }
}

if (offenders.length > 0) {
  console.error(
    '\n❌ Reusability violation: the following primitives import from `models/session/*`:\n',
  );
  for (const o of offenders) console.error('   - ' + o);
  console.error(
    "\nIf the import is intentional, add the component name to the ALLOWED set in scripts/check-reusability.mjs.\n",
  );
  process.exit(1);
}
console.log('✅ Reusability guardrail clean — no domain leakage in primitives.');
