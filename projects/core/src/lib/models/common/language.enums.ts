/**
 * UI languages the authenticated apps (web + mobile) ship translations for.
 *
 * Values are the codes stored on `User.language` and used as the ngx-translate
 * language key (`i18n/<code>.json`). English is the source language and the
 * fallback for any key a translation is missing.
 */
export const AppLanguages = {
  English: 'en',
  Romanian: 'ro',
} as const;

export type AppLanguage = (typeof AppLanguages)[keyof typeof AppLanguages];
