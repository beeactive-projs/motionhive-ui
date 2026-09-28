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
