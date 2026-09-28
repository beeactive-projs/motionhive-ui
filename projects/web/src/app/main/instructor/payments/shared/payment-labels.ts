import {
  getProductBillingLabel,
  translate,
  type BillingInterval,
  type Product,
  type Subscription,
} from 'core';

/**
 * Translated display labels shared by the coach payments pages. Plain
 * functions (not constants) so they read the active language at call time.
 */

/** Recurring cadence: "monthly", "every 2 months". */
export function billingCadence(interval: BillingInterval, intervalCount: number | null): string {
  const count = intervalCount && intervalCount > 1 ? intervalCount : 1;
  return translate('time.cadence', { interval, count });
}

/** Billing column for a product: "/ month", "/ 2 months", or "One-off". */
export function productBillingLabel(
  product: Pick<Product, 'type' | 'interval' | 'intervalCount'>,
): string {
  return getProductBillingLabel(product);
}

/** Plan name, or a short product-id stub for legacy rows without the join. */
export function subscriptionPlanName(sub: Subscription): string {
  if (sub.product?.name) return sub.product.name;
  return sub.productId
    ? translate('payments.common.planWithId', { id: sub.productId.slice(0, 8).toUpperCase() })
    : translate('payments.common.plan');
}

/** Cadence subtitle for a membership plan, or null for one-off plans. */
export function subscriptionPlanCycle(sub: Subscription): string | null {
  const p = sub.product;
  return p?.interval ? billingCadence(p.interval, p.intervalCount) : null;
}

/** "Premium · monthly" — plan name with its cadence, when it has one. */
export function subscriptionPlanLabel(sub: Subscription): string {
  const name = subscriptionPlanName(sub);
  const cadence = sub.product?.name ? subscriptionPlanCycle(sub) : null;
  return cadence ? translate('payments.common.planWithCadence', { name, cadence }) : name;
}
