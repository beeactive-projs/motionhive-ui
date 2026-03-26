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
