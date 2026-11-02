/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { isQuietHour } from './still-training.service';

describe('still training reminder', () => {
  it('stays quiet at night', () => {
    expect(isQuietHour(new Date(2026, 10, 2, 22, 5))).toBe(true);
    expect(isQuietHour(new Date(2026, 10, 3, 6, 59))).toBe(true);
    expect(isQuietHour(new Date(2026, 10, 3, 7, 0))).toBe(false);
    expect(isQuietHour(new Date(2026, 10, 2, 21, 59))).toBe(false);
  });
});
