import { UserLocation } from '../user/user.model';
import type { FitnessProfile, UpdateFitnessProfilePayload } from './fitness-profile.model';
import type { InstructorProfile, UpdateInstructorProfilePayload } from './instructor-profile.model';

export interface AccountInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarId: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  language: string | null;
  timezone: string | null;
  location?: UserLocation | null;
  createdAt: string;
}

export interface MyProfile {
  account: AccountInfo;
  roles: string[];
  // hasInstructorProfile: boolean;
  // fitnessProfile: FitnessProfile | null;
  instructorProfile: InstructorProfile | null;
}

export interface UpdateMyProfilePayload {
  account?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarId?: string;
    language?: string;
    timezone?: string;
    locationName?: string | null;
    locationAddress?: string | null;
    locationCity?: string | null;
    locationCountry?: string | null;
  };
  fitnessProfile?: UpdateFitnessProfilePayload;
  instructorProfile?: UpdateInstructorProfilePayload;
}
