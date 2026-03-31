/**
 * Patches the Romanian build's index.html with translated meta strings.
 * Runs after `ng build` as part of the Vercel build command.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/website/browser/ro/index.html';

const translations = {
  '<title>MotionHive</title>':
    '<title>MotionHive</title>',
  'content="Where active communities come together"':
    'content="Unde comunitățile active se reunesc"',
};

let html = readFileSync(path, 'utf8');

for (const [from, to] of Object.entries(translations)) {
  html = html.replaceAll(from, to);
}

writeFileSync(path, html, 'utf8');
console.log('✔ Patched ro/index.html');
