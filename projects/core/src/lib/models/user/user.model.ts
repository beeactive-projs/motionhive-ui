import type { UserRole } from './role.enums';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  roles: UserRole[];
  permissions: string[];
  language?: string | null;
  timezone?: string | null;
  location?: UserLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: UserRole[];
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  language?: string;
  timezone?: string;
}

export interface UserLocation {
  name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}
