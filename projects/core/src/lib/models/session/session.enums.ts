/**
 * Session domain enums — mirror the backend `session.enums.ts` byte-for-byte.
 *
 * Use the string-literal union types (`SessionType`, etc.) in interfaces;
 * use the `const` objects for runtime references (e.g. comparisons in
 * components, filter chip values). Either works wherever a value is needed.
 */

export const SessionType = {
  Group: 'GROUP',
  Private: 'PRIVATE',
  Open: 'OPEN',
} as const;
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

export const SessionAccess = {
  Open: 'OPEN',
  ClientsOnly: 'CLIENTS_ONLY',
  GroupOnly: 'GROUP_ONLY',
  Free: 'FREE',
} as const;
export type SessionAccess = (typeof SessionAccess)[keyof typeof SessionAccess];

export const SessionLocationKind = {
  InPerson: 'IN_PERSON',
  Online: 'ONLINE',
} as const;
export type SessionLocationKind =
  (typeof SessionLocationKind)[keyof typeof SessionLocationKind];

export const SessionMeetingProvider = {
  Zoom: 'ZOOM',
  GoogleMeet: 'GOOGLE_MEET',
  Teams: 'TEAMS',
} as const;
export type SessionMeetingProvider =
  (typeof SessionMeetingProvider)[keyof typeof SessionMeetingProvider];

export const SessionTemplateStatus = {
  Active: 'ACTIVE',
  Ended: 'ENDED',
  Cancelled: 'CANCELLED',
} as const;
export type SessionTemplateStatus =
  (typeof SessionTemplateStatus)[keyof typeof SessionTemplateStatus];

export const SessionInstanceStatus = {
  Scheduled: 'SCHEDULED',
  InProgress: 'IN_PROGRESS',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
} as const;
export type SessionInstanceStatus =
  (typeof SessionInstanceStatus)[keyof typeof SessionInstanceStatus];

export const SessionParticipantStatus = {
  PendingApproval: 'PENDING_APPROVAL',
  Confirmed: 'CONFIRMED',
  Waitlisted: 'WAITLISTED',
  Cancelled: 'CANCELLED',
  Declined: 'DECLINED',
} as const;
export type SessionParticipantStatus =
  (typeof SessionParticipantStatus)[keyof typeof SessionParticipantStatus];

export const SessionReminderKind = {
  Reminder24h: 'REMINDER_24H',
  Reminder1h: 'REMINDER_1H',
} as const;
export type SessionReminderKind =
  (typeof SessionReminderKind)[keyof typeof SessionReminderKind];

/** Cancel scope used by `POST /sessions/instances/:id/cancel`. */
export const CancelScope = {
  This: 'this',
  ThisAndFuture: 'thisAndFuture',
  Series: 'series',
} as const;
export type CancelScope = (typeof CancelScope)[keyof typeof CancelScope];

/** Follow-up audience used by `POST /sessions/instances/:id/follow-up`. */
export const FollowUpAudience = {
  All: 'all',
  Attended: 'attended',
  NoShow: 'noshow',
  UserIds: 'userIds',
} as const;
export type FollowUpAudience =
  (typeof FollowUpAudience)[keyof typeof FollowUpAudience];

/** Tabs supported by `GET /sessions/my`. */
export const MyTab = {
  Upcoming: 'upcoming',
  PendingApproval: 'pendingApproval',
  Waitlisted: 'waitlisted',
  Past: 'past',
  Cancelled: 'cancelled',
} as const;
export type MyTab = (typeof MyTab)[keyof typeof MyTab];

/** Tabs supported by `GET /sessions/templates`. */
export const TemplateTab = {
  Active: 'active',
  Recurring: 'recurring',
  Ended: 'ended',
  Cancelled: 'cancelled',
} as const;
export type TemplateTab = (typeof TemplateTab)[keyof typeof TemplateTab];
