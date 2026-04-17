import type {
  InstructorClientStatus,
  InitiatedBy,
  ClientRequestType,
  ClientRequestStatus,
} from './client.enums';
import { PaginatedResponse } from '../common/pagination.model';

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

export interface InstructorProfileSummary {
  userId: string;
  displayName: string;
  specializations: string[];
  bio: string;
  locationCity?: string;
  locationCountry?: string;
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
  invitedEmail: string | null;
  requestType: ClientRequestType;
  expiresAt: string | null;
  // instructor?: ClientUser;
  // instructorProfile?: InstructorProfileSummary | null;
  client?: ClientUser;
  groupMemberships?: GroupMembership[];
}

export interface ClientRequest {
  id: string;
  fromUserId: string;
  toUserId: string | null;
  invitedEmail: string | null;
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

export interface InvitationDetails {
  token: string;
  invitedEmail: string;
  instructor: { firstName: string; lastName: string };
  expiresAt: string;
}

export interface UpdateClientPayload {
  notes?: string;
  status?: InstructorClientStatus;
}

export interface ClientListParams {
  status?: InstructorClientStatus;
  page?: number;
  limit?: number;
}

export type ClientListResponse = PaginatedResponse<InstructorClient>;
