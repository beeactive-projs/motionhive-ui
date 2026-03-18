import type { UserRole } from './role.model';

/**
 * User Model
 */
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Create User DTO
 */
export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: UserRole[];
}

/**
 * Update User DTO
 */
export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}
