import { describe, expect, it } from 'vitest';

import { countryNameFromCode } from './countries.const';

// Specs run in English (en-GB); Romanian names come from the same Intl data.
describe('countryNameFromCode', () => {
  it('names a country in the UI language', () => {
    expect(countryNameFromCode('RO')).toBe('Romania');
    expect(countryNameFromCode('GB')).toBe('United Kingdom');
  });

  it('accepts a lowercase code', () => {
    expect(countryNameFromCode('de')).toBe('Germany');
  });

  it('is null for no code', () => {
    expect(countryNameFromCode(null)).toBeNull();
  });
});
