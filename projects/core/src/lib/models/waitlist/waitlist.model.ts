export const WaitlistRoles = {
  Instructor: 'instructor',
  User: 'user',
} as const;

export type WaitlistRole = (typeof WaitlistRoles)[keyof typeof WaitlistRoles];

export interface WaitlistPayload {
  email: string;
  name?: string;
  role?: WaitlistRole;
  source?: string;
}
