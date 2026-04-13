import type { BillingInterval, ProductType } from './payment.enums';
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
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ProductListParams {
  type?: ProductType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export type ProductListResponse = PaginatedResponse<Product>;
