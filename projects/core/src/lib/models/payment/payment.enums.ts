export const StripeAccountStatuses = {
  NotStarted: 'NOT_STARTED',
  Pending: 'PENDING',
  Restricted: 'RESTRICTED',
  Active: 'ACTIVE',
  Disconnected: 'DISCONNECTED',
} as const;

export type StripeAccountStatus =
  (typeof StripeAccountStatuses)[keyof typeof StripeAccountStatuses];

export const ProductTypes = {
  OneOff: 'ONE_OFF',
  Subscription: 'SUBSCRIPTION',
} as const;

export type ProductType = (typeof ProductTypes)[keyof typeof ProductTypes];

export const BillingIntervals = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Year: 'year',
} as const;

export type BillingInterval = (typeof BillingIntervals)[keyof typeof BillingIntervals];

export const InvoiceStatuses = {
  Draft: 'draft',
  Open: 'open',
  Paid: 'paid',
  Void: 'void',
  Uncollectible: 'uncollectible',
} as const;

export type InvoiceStatus = (typeof InvoiceStatuses)[keyof typeof InvoiceStatuses];

export const SubscriptionStatuses = {
  Trialing: 'trialing',
  Active: 'active',
  PastDue: 'past_due',
  Canceled: 'canceled',
  Unpaid: 'unpaid',
  Incomplete: 'incomplete',
  IncompleteExpired: 'incomplete_expired',
  IncompletePaymentFailed: 'incomplete_payment_failed',
  Paused: 'paused',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatuses)[keyof typeof SubscriptionStatuses];

export const PaymentStatuses = {
  Pending: 'pending',
  Succeeded: 'succeeded',
  Failed: 'failed',
  Refunded: 'refunded',
  PartiallyRefunded: 'partially_refunded',
} as const;

export type PaymentStatus = (typeof PaymentStatuses)[keyof typeof PaymentStatuses];

export const RefundReasons = {
  Duplicate: 'duplicate',
  Fraudulent: 'fraudulent',
  RequestedByCustomer: 'requested_by_customer',
} as const;

export type RefundReason = (typeof RefundReasons)[keyof typeof RefundReasons];

export const ConsentTypes = {
  ImmediateAccessWaiver: 'IMMEDIATE_ACCESS_WAIVER',
} as const;

export type ConsentType = (typeof ConsentTypes)[keyof typeof ConsentTypes];
