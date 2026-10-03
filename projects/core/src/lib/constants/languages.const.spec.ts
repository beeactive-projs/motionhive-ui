import { describe, expect, it } from 'vitest';

import { languageOfLocale } from './languages.const';

describe('languageOfLocale', () => {
  it('maps a BCP 47 locale to the app language behind it', () => {
    expect(languageOfLocale('ro-RO')).toBe('ro');
    expect(languageOfLocale('ro')).toBe('ro');
    expect(languageOfLocale('en-GB')).toBe('en');
    expect(languageOfLocale('en-US')).toBe('en');
  });

  it('falls back to English for a language the app does not speak', () => {
    expect(languageOfLocale('fr-FR')).toBe('en');
    expect(languageOfLocale('')).toBe('en');
  });
});
