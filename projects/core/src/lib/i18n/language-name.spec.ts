import { describe, expect, it } from 'vitest';

import { languageName } from './language-name';

describe('languageName', () => {
  it('names a UI language in its own language', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('ro')).toBe('Română');
  });

  it('names any other code in the UI language', () => {
    expect(languageName('de')).toBe('German');
  });

  it('is empty for no code', () => {
    expect(languageName(null)).toBe('');
  });
});
