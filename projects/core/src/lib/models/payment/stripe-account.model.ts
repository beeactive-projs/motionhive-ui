import { StripeAccountStatus, StripeAccountStatuses } from './payment.enums';

export interface StripeAccount {
  id: string;
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  defaultCurrency: string | null;
  platformFeeBps: number;
  disabledReason: string | null;
  requirementsCurrentlyDue: string[] | null;
  onboardingCompletedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStartPayload {
  returnUrl?: string;
  refreshUrl?: string;
}

export interface OnboardingStartResponse {
  url: string;
  expiresAt: string;
}

export interface OnboardingStatusResponse {
  account: StripeAccount | null;
  canIssueInvoices: boolean;
}

export interface DashboardLinkResponse {
  url: string;
}

/**
 * Derive a display status from the raw Stripe Connect flags that the
 * backend mirrors. The backend does not store a discrete status column —
 * it stores the underlying booleans and `disabled_reason` from Stripe,
 * so the UI derives its state from those flags here.
 */
export function deriveStripeAccountStatus(
  account: StripeAccount | null | undefined,
): StripeAccountStatus {
  if (!account) return StripeAccountStatuses.NotStarted;
  if (account.disconnectedAt) return StripeAccountStatuses.Disconnected;
  if (account.chargesEnabled && account.detailsSubmitted) {
    return StripeAccountStatuses.Active;
  }
  if (account.disabledReason) return StripeAccountStatuses.Restricted;
  if (account.detailsSubmitted) return StripeAccountStatuses.Pending;
  return StripeAccountStatuses.NotStarted;
}
