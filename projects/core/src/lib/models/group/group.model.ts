import type { GroupMemberPostPolicy, GroupMemberRole, JoinPolicy } from './group.enums';
import { PaginatedResponse } from '../common/pagination.model';
import type { User } from '../user/user.model';

export interface Group {
  id: string;
  instructorId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  timezone: string;
  isActive: boolean;
  isPublic: boolean;
  joinPolicy: JoinPolicy;
  memberPostPolicy: GroupMemberPostPolicy;
  tags: string[] | null;
  /** What the group trains, activity ids from `GET /categories`, in the list's order. */
  categoryIds?: string[];
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  memberCount: number;
  joinToken: string | null;
  joinTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  instructor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  /** @deprecated read role === 'OWNER' instead. Kept for FE migration window. */
  isOwner: boolean;
  sharedHealthInfo: boolean;
  nickname: string | null;
  joinedAt: string;
  leftAt: string | null;
  user?: User;
  isClient?: boolean;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  timezone?: string;
  isPublic?: boolean;
  joinPolicy?: JoinPolicy;
  memberPostPolicy?: GroupMemberPostPolicy;
  tags?: string[];
  /** What the group trains: activity ids from `GET /categories`. */
  categoryIds?: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
  timezone?: string;
  isPublic?: boolean;
  joinPolicy?: JoinPolicy;
  memberPostPolicy?: GroupMemberPostPolicy;
  tags?: string[];
  /** Replaces what the group trains; an empty list clears it, absent leaves it. */
  categoryIds?: string[];
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateMemberRolePayload {
  role: 'MEMBER' | 'MODERATOR';
}

/**
 * `GET /groups/:id` — a group plus the caller's own role in it.
 *
 * The role comes from the server because the membership row is already
 * loaded there to authorise the read. Deriving it on the client by searching
 * the member list is wrong: that list is paginated, so a moderator past the
 * first page reads as a non-member and silently loses their controls.
 */
export interface GroupWithMyRole extends Group {
  myRole: GroupMemberRole;
  /** The last published post, null when nobody has posted yet. */
  lastPostAt?: string | null;
  /** Join requests waiting on you: counted for the owner only, else 0. */
  pendingJoinRequestCount?: number;
  /** Posts waiting for review: counted for the owner and moderators, else 0. */
  pendingPostCount?: number;
  /** Who runs the group. */
  owner?: GroupOwner | null;
}

/** The person who runs a group, as a member's read of it names them. */
export interface GroupOwner {
  id: string;
  firstName: string;
  lastName: string;
  handle: string | null;
  avatarUrl: string | null;
}

/** One of my group invitations, as the invite card shows it. */
export interface PendingGroupInvitation {
  id: string;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  inviter: GroupOwner | null;
  group: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
    memberCount: number;
    categoryIds: string[];
  };
}

/** What inviting several clients did: members and open invitations are skipped. */
export interface InviteClientsResult {
  invited: number;
  skipped: number;
}

export type GroupListResponse = PaginatedResponse<Group>;
export type GroupMemberListResponse = PaginatedResponse<GroupMember>;

/**
 * `GET /groups/discover` query parameters.
 *
 * When the request is authenticated, the server excludes groups the
 * current user already belongs to and enriches each row with
 * `myJoinRequestStatus` (see `DiscoverGroup`).
 */
export interface DiscoverGroupsQuery {
  search?: string;
  tags?: string[];
  /** Groups that train any of these categories. */
  categoryIds?: readonly string[];
  city?: string;
  country?: string;
  page?: number;
  limit?: number;
}

/**
 * Group row returned by Discover. Same shape as `Group`, plus an optional
 * `myJoinRequestStatus` populated only when the caller is signed in.
 */
export interface DiscoverGroup extends Group {
  /** 'PENDING' if the current user has an outstanding join request, else null. */
  myJoinRequestStatus?: 'PENDING' | null;
}

export type DiscoverGroupListResponse = PaginatedResponse<DiscoverGroup>;

export type GroupJoinRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  status: GroupJoinRequestStatus;
  message: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export type GroupJoinRequestListResponse = PaginatedResponse<GroupJoinRequest>;

export interface DecideJoinRequestPayload {
  action: 'APPROVE' | 'REJECT';
}

/** `POST /groups/:id/join` response. Branches on the group's join policy. */
export type SelfJoinResult =
  | { status: 'JOINED'; message: string; member: GroupMember }
  | { status: 'PENDING'; message: string; request: GroupJoinRequest };

/**
 * Public-facing instructor info returned alongside a group's public profile.
 */
export interface PublicGroupInstructor {
  userId: string;
  firstName: string;
  lastName: string;
  avatarId?: string | null;
  displayName?: string | null;
  bio?: string | null;
  specializations?: string[] | null;
  yearsOfExperience?: number | null;
  isAcceptingClients?: boolean | null;
  socialLinks?: Record<string, string> | null;
}

/**
 * `GET /groups/:id/public` response. Available without membership for
 * public, active groups regardless of joinPolicy. The `group` is a
 * trimmed view (no joinToken, isActive, etc.).
 */
export interface PublicGroupProfile {
  group: Pick<
    Group,
    | 'id'
    | 'name'
    | 'slug'
    | 'description'
    | 'logoUrl'
    | 'joinPolicy'
    | 'tags'
    | 'categoryIds'
    | 'contactEmail'
    | 'contactPhone'
    | 'address'
    | 'city'
    | 'country'
    | 'timezone'
    | 'createdAt'
    | 'memberCount'
  >;
  instructor: PublicGroupInstructor | null;
  upcomingSessions: PublicGroupSession[];
}

export interface PublicGroupSession {
  id: string;
  title: string;
  description: string | null;
  sessionType: string;
  visibility: 'PUBLIC' | 'GROUP';
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  maxParticipants: number | null;
  price: number | null;
  currency: string | null;
  status: string;
}
