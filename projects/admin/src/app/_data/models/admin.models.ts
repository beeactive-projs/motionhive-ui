/**
 * Admin-app DTOs. These mirror the `/admin/*` backend responses. Kept in
 * the admin project (not core) so iterating on admin doesn't force a
 * `core` rebuild each time.
 */

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  handle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  city: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  roles: string[];
}

export interface AdminUserDetail extends AdminUserListItem {
  counts: { groups: number; sessions: number; clients: number };
  instructorProfile: {
    id: string;
    displayName: string;
    isPublic: boolean;
    isAcceptingClients: boolean;
  } | null;
  stripeAccount: {
    stripeAccountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    country: string | null;
    defaultCurrency: string | null;
    disabledReason: string | null;
  } | null;
  lastSession: {
    expiresAt: string;
    revoked: boolean;
    deviceInfo: string | null;
    ipAddress: string | null;
  } | null;
}

export interface AdminUserFilters {
  page?: number;
  limit?: number;
  q?: string;
  role?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  locked?: boolean;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface UpdateUserStatusPayload {
  isActive?: boolean;
  unlock?: boolean;
  forceEmailVerified?: boolean;
}

export interface AdminOverview {
  users: { total: number; active: number; deleted: number };
  instructors: number;
  groups: number;
  sessions: { total: number; completed: number };
  payments: {
    activeSubscriptions: number;
    openDisputes: number;
    failedWebhooks: number;
  };
  moderation: { openMessageReports: number };
}

export interface DbTableInfo {
  key: string;
  label: string;
  rows: number;
}

export type DbRow = Record<string, unknown>;

export interface ImpersonateResponse {
  accessToken: string;
  expiresIn: string;
  targetUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}
