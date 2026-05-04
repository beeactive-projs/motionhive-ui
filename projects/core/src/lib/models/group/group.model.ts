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
