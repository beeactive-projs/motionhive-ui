import type { WaitlistRole } from './waitlist.enums';

export interface WaitlistPayload {
  email: string;
  name?: string;
  role?: WaitlistRole;
  source?: string;
}
