import { enumLabelMap } from '../../i18n/enum-label';
import { translate } from '../../i18n/translator';

export const InstructorClientStatuses = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
} as const;

export type InstructorClientStatus = (typeof InstructorClientStatuses)[keyof typeof InstructorClientStatuses];

export const InitiatedByOptions = {
  Instructor: 'INSTRUCTOR',
  Client: 'CLIENT',
} as const;

export type InitiatedBy = (typeof InitiatedByOptions)[keyof typeof InitiatedByOptions];

export const ClientRequestTypes = {
  ClientToInstructor: 'CLIENT_TO_INSTRUCTOR',
  InstructorToClient: 'INSTRUCTOR_TO_CLIENT',
} as const;

export type ClientRequestType = (typeof ClientRequestTypes)[keyof typeof ClientRequestTypes];

export const ClientRequestStatuses = {
  Pending: 'PENDING',
  Accepted: 'ACCEPTED',
  Declined: 'DECLINED',
  Cancelled: 'CANCELLED',
} as const;

export type ClientRequestStatus = (typeof ClientRequestStatuses)[keyof typeof ClientRequestStatuses];

/**
 * Delivery of an imported invite's email (`emailStatus` on a pending row).
 * Absent on invites sent one at a time, which never tracked it.
 */
export const ClientInviteEmailStatuses = {
  Queued: 'QUEUED',
  Sent: 'SENT',
  Failed: 'FAILED',
} as const;

export type ClientInviteEmailStatus =
  (typeof ClientInviteEmailStatuses)[keyof typeof ClientInviteEmailStatuses];

/**
 * What a client import does with one row, from `POST /clients/import/preview`.
 * Each is a fact about the coach's own data; the API never says whether an
 * address has a MotionHive account, so both kinds of person read Invite.
 */
export const ClientImportRowStatuses = {
  Invite: 'INVITE',
  AlreadyInvited: 'ALREADY_INVITED',
  AlreadyClient: 'ALREADY_CLIENT',
  ArchivedClient: 'ARCHIVED_CLIENT',
  RequestedYou: 'REQUESTED_YOU',
  Duplicate: 'DUPLICATE',
  InvalidEmail: 'INVALID_EMAIL',
  Self: 'SELF',
} as const;

export type ClientImportRowStatus =
  (typeof ClientImportRowStatuses)[keyof typeof ClientImportRowStatuses];

/**
 * Why the API suggested a coach. Only SUGGESTED is sent today; sponsored
 * placements will arrive under a new reason, so a reason this list does not
 * know is treated as an ordinary suggestion.
 */
export const CoachSuggestionReasons = {
  Suggested: 'SUGGESTED',
} as const;

export type CoachSuggestionReason =
  (typeof CoachSuggestionReasons)[keyof typeof CoachSuggestionReasons];

/** Translated on read — see `enumLabelMap`. */
export const ClientStatusLabels: Record<InstructorClientStatus, string> = enumLabelMap(
  'clientStatus',
  Object.values(InstructorClientStatuses),
);

/** Which kind of pending row a client is — each word translated on read. */
export const PendingClientLabels = {
  get Invited(): string {
    return translate('enum.pendingClient.INVITED');
  },
  get EmailSent(): string {
    return translate('enum.pendingClient.EMAIL_SENT');
  },
  get Request(): string {
    return translate('enum.pendingClient.REQUEST');
  },
};
