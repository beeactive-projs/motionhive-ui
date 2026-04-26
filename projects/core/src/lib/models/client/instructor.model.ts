import { InstructorCertification } from '../profile/instructor-profile.model';

export interface MyInstructorUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarId: string | null;
}

export interface MyInstructorProfile {
  userId: string;
  displayName: string | null;
  specializations: string[];
  bio: string | null;
}

export interface MyInstructor {
  id: string;
  instructorId: string;
  clientId: string;
  status: string;
  startedAt: string;
  instructor: MyInstructorUser;
  instructorProfile: MyInstructorProfile | null;
}

/**
 * Backend returns a plain array of active instructor relationships.
 */
export type InstructorListResponse = MyInstructor[];

export interface InstructorSearchResult {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  displayName: string | null;
  bio: string | null;
  specializations: string[] | null;
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  city: string | null;
  country: string | null;
  socialLinks: Record<string, string> | null;
}

export interface PublicInstructorProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  displayName: string | null;
  bio: string | null;
  specializations: string[];
  certifications: InstructorCertification[];
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  city: string | null;
  country: string | null;
  socialLinks: Record<string, string> | null;
  showEmail: boolean;
  showPhone: boolean;
}
