import { PaginatedResponse } from '../common/pagination.model';

export const InstructorClientStatuses = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
} as const;

export type InstructorClientStatus =
  (typeof InstructorClientStatuses)[keyof typeof InstructorClientStatuses];

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

export type ClientRequestStatus =
  (typeof ClientRequestStatuses)[keyof typeof ClientRequestStatuses];

export interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarId?: string;
}

export interface GroupMembership {
  groupId: string;
  groupName: string;
}

export interface InstructorClient {
  id: string;
  instructorId: string;
  clientId: string;
  status: InstructorClientStatus;
  initiatedBy: InitiatedBy;
  notes: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: ClientUser;
  instructor?: ClientUser;
  instructorProfile?: InstructorProfileSummary | null;
  groupMemberships?: GroupMembership[];
}

export interface InstructorProfileSummary {
  userId: string;
  displayName: string;
  specializations: string[];
  bio: string;
  locationCity?: string;
  locationCountry?: string;
}

export interface ClientRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: ClientRequestType;
  message: string | null;
  status: ClientRequestStatus;
  token: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  fromUser?: ClientUser;
  toUser?: ClientUser;
}

export interface CreateClientInvitation {
  email: string;
  message?: string;
}

export interface UpdateClientPayload {
  notes?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}

export interface ClientListParams {
  status?: InstructorClientStatus;
  page?: number;
  limit?: number;
}

export type ClientListResponse = PaginatedResponse<InstructorClient>;
