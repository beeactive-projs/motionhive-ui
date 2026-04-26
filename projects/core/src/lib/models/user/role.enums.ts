export const UserRoles = {
  SuperAdmin: 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Support: 'SUPPORT',
  Writer: 'WRITER',
  Instructor: 'INSTRUCTOR',
  User: 'USER',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
