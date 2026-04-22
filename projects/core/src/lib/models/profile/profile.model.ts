import type { FitnessProfile, UpdateFitnessProfilePayload } from './fitness-profile.model';
import type { InstructorProfile, UpdateInstructorProfilePayload } from './instructor-profile.model';

export interface AccountInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  language: string | null;
  timezone: string | null;
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
  };
  fitnessProfile?: UpdateFitnessProfilePayload;
  instructorProfile?: UpdateInstructorProfilePayload;
}
