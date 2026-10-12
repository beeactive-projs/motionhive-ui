import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../constants/storage-keys.const';
import { resolveInitialLanguage } from './app-language';

describe('resolveInitialLanguage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  const browserPrefers = (...languages: string[]) =>
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

  const landOn = (path: string) => window.history.replaceState(null, '', path);

  it('takes the language a link hands over, over the stored choice, and stores it', () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');
    browserPrefers('en-US');
    landOn('/auth/signup?lang=ro');
    expect(resolveInitialLanguage()).toBe('ro');
    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe('ro');
  });

  it('strips the language param and keeps the rest of the URL', () => {
    landOn('/auth/signup?token=abc&lang=ro#top');
    resolveInitialLanguage();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/auth/signup?token=abc#top',
    );
  });

  it('keeps the account language over a linked one when signed in', () => {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');
    landOn('/auth/signup?lang=ro');
    expect(resolveInitialLanguage()).toBe('en');
    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe('en');
    expect(window.location.search).toBe('');
  });

  it('ignores an unsupported linked language', () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ro');
    landOn('/auth/signup?lang=fr');
    expect(resolveInitialLanguage()).toBe('ro');
    expect(window.location.search).toBe('');
  });

  it("prefers the device's stored choice over the browser", () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ro');
    browserPrefers('en-US');
    expect(resolveInitialLanguage()).toBe('ro');
  });

  it('ignores a stored value that is not a supported language', () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'fr');
    browserPrefers('ro-RO');
    expect(resolveInitialLanguage()).toBe('ro');
  });

  it('takes the first supported browser language, by base tag', () => {
    browserPrefers('de-DE', 'ro-RO', 'en-GB');
    expect(resolveInitialLanguage()).toBe('ro');
  });

  it('falls back to English', () => {
    browserPrefers('de-DE', 'fr');
    expect(resolveInitialLanguage()).toBe('en');
  });
});
