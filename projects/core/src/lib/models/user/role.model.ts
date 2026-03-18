/**
 * Role Model
 */
export interface Role {
  id: string;
  name: string; // e.g., "ORGANIZER", "PARTICIPANT", "SUPER_ADMIN"
  displayName: string; // e.g., "Organizer", "Participant"
  description?: string;
  permissions: string[]; // Array of permission names
  createdAt: Date;
  updatedAt: Date;
}

export const UserRoles = {
  SuperAdmin: 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Support: 'SUPPORT',
  Instructor: 'INSTRUCTOR',
  User: 'USER',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

/**
 * User Role Assignment
 */
export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  roleName: string;
  assignedAt: Date;
}
