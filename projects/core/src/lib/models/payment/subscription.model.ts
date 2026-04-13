import type { SubscriptionStatus } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface Subscription {
  id: string;
  instructorId: string;
  clientId: string | null;
  productId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  canceledAt: string | null;
  trialEnd: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionPayload {
  clientUserId: string;
  productId: string;
  trialDays?: number;
  startAt?: string;
}

export interface CancelSubscriptionPayload {
  immediate?: boolean;
}

export interface SubscriptionListParams {
  status?: SubscriptionStatus;
  clientId?: string;
  page?: number;
  limit?: number;
}

export type SubscriptionListResponse = PaginatedResponse<Subscription>;
