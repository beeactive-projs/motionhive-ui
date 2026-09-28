export type TranslateParams = Record<string, unknown>;
export type TranslateFn = (key: string, params?: TranslateParams) => string;

/**
 * Translation for plain functions — the formatting utils (`session-format`,
 * `messaging`, `api-error`) run outside any injection context, so they cannot
 * inject `TranslateService`. `provideAppI18n()` registers the real translator
 * once the language file has loaded; until then (and in unit specs that don't
 * register one) a key comes back as itself.
 *
 * Held on `globalThis` under a registry symbol rather than in a module
 * variable: the unit-test builder bundles setup files apart from specs, so
 * this module can exist twice, and both copies must see one registration.
 */
const TRANSLATOR = Symbol.for('motionhive.i18n.translator');

interface TranslatorHolder {
  [TRANSLATOR]?: TranslateFn;
}

export function registerTranslator(fn: TranslateFn): void {
  (globalThis as TranslatorHolder)[TRANSLATOR] = fn;
}

export function translate(key: string, params?: TranslateParams): string {
  const fn = (globalThis as TranslatorHolder)[TRANSLATOR];
  return fn ? fn(key, params) : key;
}
