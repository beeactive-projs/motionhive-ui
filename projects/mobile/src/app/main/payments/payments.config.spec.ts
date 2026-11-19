import { describe, expect, it } from 'vitest';

import { segmentFrom } from './payments.config';

describe('segmentFrom', () => {
  it('reads the segment a link names', () => {
    expect(segmentFrom('memberships')).toBe('memberships');
    expect(segmentFrom('invoices')).toBe('invoices');
  });

  it('ignores anything else', () => {
    expect(segmentFrom(null)).toBeNull();
    expect(segmentFrom('billing')).toBeNull();
  });
});
