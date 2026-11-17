import { describe, expect, it } from 'vitest';

import { decimalSeparator, decimalToNumber, localizeTypedNumber } from './number.utils';

// Specs run in English (en-GB); Romanian swaps the mark for a comma.
describe('decimalSeparator', () => {
  it('is the UI locale decimal mark', () => {
    expect(decimalSeparator()).toBe('.');
  });
});

// The API sends DECIMAL columns as strings; a missing target must stay null, never 0.
describe('decimalToNumber', () => {
  it('reads a DECIMAL string or a number as a number', () => {
    expect(decimalToNumber('82.50')).toBe(82.5);
    expect(decimalToNumber(60)).toBe(60);
    expect(decimalToNumber('0')).toBe(0);
  });

  it('is null for nothing, an empty string or a value that is not a number', () => {
    expect(decimalToNumber(null)).toBeNull();
    expect(decimalToNumber(undefined)).toBeNull();
    expect(decimalToNumber('')).toBeNull();
    expect(decimalToNumber('abc')).toBeNull();
    expect(decimalToNumber(Number.NaN)).toBeNull();
  });
});

describe('localizeTypedNumber', () => {
  it('keeps typed input as typed, trailing mark included', () => {
    expect(localizeTypedNumber('82.5')).toBe('82.5');
    expect(localizeTypedNumber('82.')).toBe('82.');
    expect(localizeTypedNumber('1250')).toBe('1250');
  });
});
