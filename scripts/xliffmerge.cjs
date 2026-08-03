#!/usr/bin/env node
/**
 * xliffmerge launcher shim.
 *
 * `ngx-i18nsupport`'s xliffmerge still calls `util.isNullOrUndefined()` and
 * `util.isArray()`. Node deprecated both long ago and REMOVED them in v22, so
 * on any current Node the CLI dies with:
 *
 *   TypeError: util_1.isNullOrUndefined is not a function
 *
 * which silently left messages.ro.xlf without any newly extracted strings.
 * The package is unmaintained, so instead of pinning an ancient Node we
 * restore the two functions before loading the CLI. Behaviour is identical to
 * the originals.
 *
 * Usage (see the `extract-i18n` npm script):
 *   node scripts/xliffmerge.cjs --profile xliffmerge.json
 */
const util = require('util');

if (typeof util.isNullOrUndefined !== 'function') {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}
if (typeof util.isArray !== 'function') {
  util.isArray = Array.isArray;
}

require('ngx-i18nsupport/dist/xliffmerge/main.js');
