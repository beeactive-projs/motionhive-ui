import { describe, expect, it } from 'vitest';

import { decimalSeparator, localizeTypedNumber } from './number.utils';

// Specs run in English (en-GB); Romanian swaps the mark for a comma.
describe('decimalSeparator', () => {
  it('is the UI locale decimal mark', () => {
    expect(decimalSeparator()).toBe('.');
  });
});

describe('localizeTypedNumber', () => {
  it('keeps typed input as typed, trailing mark included', () => {
    expect(localizeTypedNumber('82.5')).toBe('82.5');
    expect(localizeTypedNumber('82.')).toBe('82.');
    expect(localizeTypedNumber('1250')).toBe('1250');
  });
});
