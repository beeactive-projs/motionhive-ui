import { describe, expect, it } from 'vitest';

import { formatMinorUnits } from './money.utils';

// Specs run in English (en-GB); Romanian swaps the decimal mark for a comma.
describe('formatMinorUnits', () => {
  it('renders two decimals, like the toFixed(2) it replaced', () => {
    expect(formatMinorUnits(4950)).toBe('49.50');
    expect(formatMinorUnits(5000)).toBe('50.00');
  });

  it('drops decimals from whole amounts when asked', () => {
    expect(formatMinorUnits(5000, { trimWholeNumbers: true })).toBe('50');
    expect(formatMinorUnits(4950, { trimWholeNumbers: true })).toBe('49.50');
  });

  it('never groups thousands', () => {
    expect(formatMinorUnits(123456)).toBe('1234.56');
  });
});
