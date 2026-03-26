export const WaitlistRoles = {
  Instructor: 'instructor',
  User: 'user',
} as const;

export type WaitlistRole = (typeof WaitlistRoles)[keyof typeof WaitlistRoles];
