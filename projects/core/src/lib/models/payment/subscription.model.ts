import type { BillingInterval, SubscriptionStatus } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

/** Lightweight client snapshot returned alongside the subscription. */
export interface SubscriptionClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}

/** Lightweight plan snapshot returned alongside the subscription. */
export interface SubscriptionPlan {
  id: string;
  name: string;
  interval: BillingInterval | null;
  intervalCount: number | null;
}

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
  /** Eager-loaded client snapshot — present on listForInstructor. */
  client?: SubscriptionClient | null;
  /** Eager-loaded plan snapshot — present on listForInstructor. */
  product?: SubscriptionPlan | null;
  /**
   * Transient — only populated on the `create` response when the new
   * subscription requires the client's confirmation (always-confirm
   * policy). Hosts the Stripe-hosted invoice page where the client
   * confirms with a saved card or a new one. NOT persisted; fetch a
   * fresh URL via `subscriptions/:id/setup-link` for re-share.
   */
  pendingConfirmationUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response shape for `POST /payments/subscriptions/:id/setup-link`. */
export interface SetupLinkResponse {
  /** Stripe-hosted Checkout URL, or null if subscription is past INCOMPLETE. */
  url: string | null;
  status: SubscriptionStatus;
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
