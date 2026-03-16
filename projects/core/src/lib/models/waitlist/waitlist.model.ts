export type WaitlistRole = 'instructor' | 'user';

export interface WaitlistPayload {
  email: string;
  name?: string;
  role?: WaitlistRole;
  source?: string;
}
