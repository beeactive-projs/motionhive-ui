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
  SessionFollowUp = 'SESSION_FOLLOW_UP',
  ParticipantJoined = 'PARTICIPANT_JOINED',
  ParticipantLeft = 'PARTICIPANT_LEFT',
  // Coaching
  ClientRequestReceived = 'CLIENT_REQUEST_RECEIVED',
  ClientRequestAccepted = 'CLIENT_REQUEST_ACCEPTED',
  ClientRequestDeclined = 'CLIENT_REQUEST_DECLINED',
  ClientInvitationReceived = 'CLIENT_INVITATION_RECEIVED',
  ClientRelationshipEnded = 'CLIENT_RELATIONSHIP_ENDED',
  // Groups
  GroupInvitationReceived = 'GROUP_INVITATION_RECEIVED',
  GroupInvitationAccepted = 'GROUP_INVITATION_ACCEPTED',
  GroupInvitationDeclined = 'GROUP_INVITATION_DECLINED',
  GroupMemberJoined = 'GROUP_MEMBER_JOINED',
  GroupMemberLeft = 'GROUP_MEMBER_LEFT',
  GroupMemberRemoved = 'GROUP_MEMBER_REMOVED',
  GroupMemberRoleChanged = 'GROUP_MEMBER_ROLE_CHANGED',
  GroupOwnershipTransferred = 'GROUP_OWNERSHIP_TRANSFERRED',
  GroupJoinRequestReceived = 'GROUP_JOIN_REQUEST_RECEIVED',
  GroupJoinRequestApproved = 'GROUP_JOIN_REQUEST_APPROVED',
  GroupJoinRequestRejected = 'GROUP_JOIN_REQUEST_REJECTED',
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
  DisputeEvidenceDue = 'DISPUTE_EVIDENCE_DUE',
  RefundIssued = 'REFUND_ISSUED',
  RefundWindowClosing = 'REFUND_WINDOW_CLOSING',
  CardExpiringSoon = 'CARD_EXPIRING_SOON',
  EarningsSummary = 'EARNINGS_SUMMARY',
  // Posts
  PostNewComment = 'POST_NEW_COMMENT',
  PostPendingApproval = 'POST_PENDING_APPROVAL',
  PostApproved = 'POST_APPROVED',
  PostRejected = 'POST_REJECTED',
  // Messaging
  MessageReceived = 'MESSAGE_RECEIVED',
  // Workouts (exercises + programs)
  ExerciseForked = 'EXERCISE_FORKED',
  ProgramAssigned = 'PROGRAM_ASSIGNED',
  ClientCompletedWorkout = 'CLIENT_COMPLETED_WORKOUT',
  ClientCompletedPlan = 'CLIENT_COMPLETED_PLAN',
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
