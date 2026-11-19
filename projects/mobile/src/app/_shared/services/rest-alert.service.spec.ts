import { describe, expect, it } from 'vitest';

import { restAlertEnded } from './rest-alert.service';

const END = Date.UTC(2026, 10, 19, 9, 0, 0);

describe('restAlertEnded', () => {
  it('takes the alert down when the rest ends, shown or still to come', () => {
    expect(restAlertEnded(END, null, false)).toBe(true);
    expect(restAlertEnded(END, null, true)).toBe(true);
  });

  it('takes down one this side set even when no rest was known', () => {
    expect(restAlertEnded(null, null, true)).toBe(true);
  });

  it('leaves it alone while a rest runs, or when there was none', () => {
    expect(restAlertEnded(END, END + 15_000, true)).toBe(false);
    expect(restAlertEnded(null, END, false)).toBe(false);
    expect(restAlertEnded(null, null, false)).toBe(false);
  });
});
