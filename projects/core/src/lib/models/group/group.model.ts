export type JoinPolicy = 'OPEN' | 'APPROVAL' | 'INVITE_ONLY';

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
  tags: string[];
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
  isOwner: boolean;
  sharedHealthInfo: boolean;
  nickname: string | null;
  joinedAt: string;
  leftAt: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarId?: string;
  };
  isClient?: boolean;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  timezone?: string;
  isPublic?: boolean;
  joinPolicy?: JoinPolicy;
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
  tags?: string[];
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface GroupListResponse {
  items: Group[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GroupMemberListResponse {
  items: GroupMember[];
  total: number;
  page: number;
  pageSize: number;
}
