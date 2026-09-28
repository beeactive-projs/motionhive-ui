import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../constants/storage-keys.const';
import { resolveInitialLanguage } from './app-language';

describe('resolveInitialLanguage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const browserPrefers = (...languages: string[]) =>
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

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
