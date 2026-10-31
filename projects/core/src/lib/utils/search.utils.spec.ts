import { describe, expect, it } from 'vitest';

import { foldForSearch, foldedIncludes } from './search.utils';

describe('foldForSearch', () => {
  it('drops case and accents, both Romanian forms included', () => {
    expect(foldForSearch('São Paulo')).toBe('sao paulo');
    expect(foldForSearch('Ștefan Şerban Țară Ţară Brașov')).toBe('stefan serban tara tara brasov');
    expect(foldForSearch('Forță pentru începători')).toBe('forta pentru incepatori');
    // The letters a decomposition keeps whole, folded as the server's unaccent does.
    expect(foldForSearch('Straße Łódź Ærø Œuvre Đorđe')).toBe('strasse lodz aero oeuvre dorde');
  });
});

describe('foldedIncludes', () => {
  it('matches across accents either way', () => {
    expect(foldedIncludes('Alergăm în Cluj', 'alergam in')).toBe(true);
    expect(foldedIncludes('Stefan Pop', 'Ștefan')).toBe(true);
    expect(foldedIncludes('Anna', 'bob')).toBe(false);
  });

  it('matches anything with an empty query and nothing with no text', () => {
    expect(foldedIncludes('Anna', '  ')).toBe(true);
    expect(foldedIncludes(null, 'a')).toBe(false);
  });
});
