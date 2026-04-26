import { ProductTypes, type BillingInterval, type ProductType } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface Product {
  id: string;
  instructorId: string;
  name: string;
  description: string | null;
  type: ProductType;
  amountCents: number;
  currency: string;
  interval: BillingInterval | null;
  intervalCount: number | null;
  stripeProductId: string;
  stripePriceId: string;
  isActive: boolean;
  showOnProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  type: ProductType;
  amountCents: number;
  currency?: string;
  interval?: BillingInterval;
  intervalCount?: number;
  showOnProfile?: boolean;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  showOnProfile?: boolean;
}

export interface ProductListParams {
  type?: ProductType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export type ProductListResponse = PaginatedResponse<Product>;

/**
 * Human-friendly billing cadence label for a product.
 * - One-off → "One-off"
 * - Subscription (count=1) → "/ month"
 * - Subscription (count=2) → "/ 2 months"
 *
 * Kept as a pure helper on the model so the instructor product list,
 * the public profile, and the profile details tab all render billing
 * the same way.
 */
export function getProductBillingLabel(
  product: Pick<Product, 'type' | 'interval' | 'intervalCount'>,
): string {
  if (product.type !== ProductTypes.Subscription || !product.interval) {
    return 'One-off';
  }
  const count = product.intervalCount ?? 1;
  return count === 1
    ? `/ ${product.interval}`
    : `/ ${count} ${product.interval}s`;
}
