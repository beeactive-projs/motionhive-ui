import type {
  InstructorClientStatus,
  InitiatedBy,
  ClientImportRowStatus,
  ClientInviteEmailStatus,
  ClientRequestType,
  ClientRequestStatus,
} from './client.enums';
import type { AppLanguage } from '../common/language.enums';
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
  /** The name the coach gave someone with no account yet (client import). */
  invitedFirstName?: string | null;
  invitedLastName?: string | null;
  /** Delivery of an imported invite's email; absent on other rows. */
  emailStatus?: ClientInviteEmailStatus | null;
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
  invitedFirstName?: string | null;
  invitedLastName?: string | null;
  emailStatus?: ClientInviteEmailStatus | null;
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

/**
 * `GET /clients/requests/pending/count`. `count` is both directions;
 * `incoming` is the requests waiting on the coach's answer, `outgoing` the
 * invitations they sent. Anything that says "waiting for you" reads `incoming`.
 */
export interface PendingRequestsCount {
  count: number;
  incoming: number;
  outgoing: number;
}

export type CreateClientInvitation =
  | { userId: string; email?: never; message?: string }
  | { email: string; userId?: never; message?: string };

export interface InvitationDetails {
  token: string;
  invitedEmail: string;
  /** The coach's spelling of the invitee's name, for signup to start from. */
  invitedFirstName?: string | null;
  invitedLastName?: string | null;
  instructor: { firstName: string; lastName: string };
  expiresAt: string;
}

/** One person from a coach's spreadsheet. Only `email` is required. */
export interface ClientImportRow {
  email: string;
  firstName?: string;
  lastName?: string;
  /** The coach's private note; becomes the client's notes when they accept. */
  note?: string;
}

/** Body of `POST /clients/import/preview` and `POST /clients/import`. */
export interface ClientImportRequest {
  rows: ClientImportRow[];
  /** One personal message, in every invite email. */
  message?: string;
  /** Email language for people with no account; one with an account reads theirs. */
  locale?: AppLanguage;
  /** Also send again to people already invited (renews them for 30 days). */
  resendPending?: boolean;
}

export interface ClientImportRowResult {
  /** Position in the submitted `rows`. */
  index: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: ClientImportRowStatus;
  /** When the invite already out was sent (ALREADY_INVITED only). */
  invitedAt: string | null;
}

export interface ClientImportResult {
  dryRun: boolean;
  rows: ClientImportRowResult[];
  counts: Record<ClientImportRowStatus, number>;
  /** Invite emails this import sends, or in a preview would send. */
  toSend: number;
  /** Invite emails the coach has left in the last 24 hours, before this import. */
  dailyRemaining: number;
}

/** Body of `POST /clients/import/email-preview`. */
export interface ClientImportEmailPreviewRequest {
  message?: string;
  locale?: AppLanguage;
  /** Who the sample is addressed to: the first person on the list. */
  recipientFirstName?: string;
}

/** The import's invite email, rendered by the API exactly as it will be sent. */
export interface ClientImportEmailPreview {
  subject: string;
  html: string;
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
