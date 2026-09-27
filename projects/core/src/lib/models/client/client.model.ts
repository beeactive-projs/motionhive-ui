import type {
  InstructorClientStatus,
  InitiatedBy,
  ClientRequestType,
  ClientRequestStatus,
} from './client.enums';
import { PaginatedResponse } from '../common/pagination.model';
import { User } from '../user/user.model';

export interface GroupMembership {
  groupId: string;
  groupName: string;
}

export interface InstructorProfileSummary {
  userId: string;
  displayName: string;
  specializations: string[];
  bio: string;
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
  client?: User;
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
  fromUser?: User;
  toUser?: User;
}

export type CreateClientInvitation =
  | { userId: string; email?: never; message?: string }
  | { email: string; userId?: never; message?: string };

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
  /**
   * Narrow to pending rows pointing one way. Only a pending row has a
   * direction, so setting this excludes settled relationships.
   */
  direction?: ClientDirection;
  /**
   * Server-side search over the client's name, email, and the address an
   * email-only invitation went to. Whitespace splits it into tokens that
   * must all match, so "anna popescu" spans first and last name. Terms
   * under two characters are ignored by the API.
   */
  search?: string;
}

/** Which way a pending row points — mirrors the API's `ClientDirection`. */
export const ClientDirections = {
  Incoming: 'incoming',
  Outgoing: 'outgoing',
} as const;

export type ClientDirection =
  (typeof ClientDirections)[keyof typeof ClientDirections];

export type ClientListResponse = PaginatedResponse<InstructorClient>;
