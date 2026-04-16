import type { SubscriptionStatus } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface Subscription {
  id: string;
  instructorId: string;
  clientId: string | null;
  productId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  trialStart: string | null;
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
