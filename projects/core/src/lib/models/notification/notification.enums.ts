/**
 * Catalog of notification events. Mirrors the BE NotificationType enum
 * exactly — keep these in sync if either side adds a new type.
 *
 * The FE doesn't use the type for rendering (every type renders the
 * same way in the bell — title + body + severity icon). It's used for
 * deep-linking decisions and analytics.
 */
export enum NotificationType {
  // Sessions
  SessionReminder24h = 'SESSION_REMINDER_24H',
  SessionReminder1h = 'SESSION_REMINDER_1H',
  SessionCancelled = 'SESSION_CANCELLED',
  SessionRescheduled = 'SESSION_RESCHEDULED',
  SessionStatusChanged = 'SESSION_STATUS_CHANGED',
  ParticipantJoined = 'PARTICIPANT_JOINED',
  ParticipantLeft = 'PARTICIPANT_LEFT',
  // Coaching
  ClientRequestReceived = 'CLIENT_REQUEST_RECEIVED',
  ClientRequestAccepted = 'CLIENT_REQUEST_ACCEPTED',
  ClientInvitationReceived = 'CLIENT_INVITATION_RECEIVED',
  // Groups
  GroupInvitationReceived = 'GROUP_INVITATION_RECEIVED',
  GroupInvitationAccepted = 'GROUP_INVITATION_ACCEPTED',
  GroupMemberJoined = 'GROUP_MEMBER_JOINED',
  GroupMemberLeft = 'GROUP_MEMBER_LEFT',
  GroupMemberRemoved = 'GROUP_MEMBER_REMOVED',
  GroupOwnershipTransferred = 'GROUP_OWNERSHIP_TRANSFERRED',
  // Payments
  InvoiceCreated = 'INVOICE_CREATED',
  InvoiceDueSoon = 'INVOICE_DUE_SOON',
  InvoiceOverdue = 'INVOICE_OVERDUE',
  InvoicePaid = 'INVOICE_PAID',
  PaymentFailed = 'PAYMENT_FAILED',
  SubscriptionCreated = 'SUBSCRIPTION_CREATED',
  SubscriptionCanceled = 'SUBSCRIPTION_CANCELED',
  PayoutSent = 'PAYOUT_SENT',
  StripeAccountReady = 'STRIPE_ACCOUNT_READY',
  StripeAccountRestricted = 'STRIPE_ACCOUNT_RESTRICTED',
  DisputeOpened = 'DISPUTE_OPENED',
  RefundIssued = 'REFUND_ISSUED',
  // Posts
  PostNewComment = 'POST_NEW_COMMENT',
  PostPendingApproval = 'POST_PENDING_APPROVAL',
  PostApproved = 'POST_APPROVED',
  PostRejected = 'POST_REJECTED',
}

/**
 * Severity drives icon + color in the bell list. Lowercase to match
 * PrimeNG's MessageService severity values directly — we can pass
 * these through to Toast without translation.
 */
export enum NotificationSeverity {
  Info = 'info',
  Success = 'success',
  Warn = 'warn',
  Error = 'error',
}

/**
 * Channels a notification can be delivered through. The bell list
 * doesn't show this — it's only used in the settings tab.
 */
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

/**
 * Device platform where a push token was minted. Mirrors the BE
 * `device_platform` enum.
 */
export enum DevicePlatform {
  Web = 'WEB',
  Ios = 'IOS',
  Android = 'ANDROID',
}
