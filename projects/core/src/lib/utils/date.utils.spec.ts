import { describe, expect, it } from 'vitest';

import { dayRange, monthRange } from './date.utils';

describe('date ranges', () => {
  it('spans one local day, midnight to midnight', () => {
    expect(dayRange('2026-10-29')).toEqual({
      dateFrom: new Date(2026, 9, 29).toISOString(),
      dateTo: new Date(2026, 9, 30).toISOString(),
    });
  });

  it('crosses into the next month and year', () => {
    expect(dayRange('2026-12-31').dateTo).toBe(new Date(2027, 0, 1).toISOString());
  });

  it('spans the month of any day in it', () => {
    expect(monthRange(new Date(2026, 1, 17, 15))).toEqual({
      dateFrom: new Date(2026, 1, 1).toISOString(),
      dateTo: new Date(2026, 2, 1).toISOString(),
    });
  });
});
