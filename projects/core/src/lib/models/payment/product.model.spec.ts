import { describe, expect, it } from 'vitest';

import { ProductTypes } from './payment.enums';
import { getProductBillingLabel } from './product.model';

describe('getProductBillingLabel', () => {
  it('names a one-off product', () => {
    expect(getProductBillingLabel({ type: ProductTypes.OneOff, interval: null, intervalCount: null })).toBe(
      'One-off',
    );
  });

  it('reads a single interval without a count', () => {
    expect(
      getProductBillingLabel({ type: ProductTypes.Subscription, interval: 'month', intervalCount: 1 }),
    ).toBe('/ month');
    expect(
      getProductBillingLabel({ type: ProductTypes.Subscription, interval: 'year', intervalCount: null }),
    ).toBe('/ year');
  });

  it('pluralises a multi-interval cadence', () => {
    expect(
      getProductBillingLabel({ type: ProductTypes.Subscription, interval: 'week', intervalCount: 2 }),
    ).toBe('/ 2 weeks');
  });
});
