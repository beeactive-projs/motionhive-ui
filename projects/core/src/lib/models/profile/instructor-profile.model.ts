import type { SessionType, AvailableDay } from './profile.enums';

export interface InstructorCertification {
  name: string;
  issuer: string;
  year: number;
}

export interface InstructorProfile {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  specializations: string[] | null;
  certifications: InstructorCertification[] | null;
  yearsOfExperience: number | null;
  sessionTypes: SessionType[];
  availableDays: AvailableDay[];
  languages: string[];
  websiteUrl: string | null;
  videoIntroUrl: string | null;
  maxClients: number | null;
  isAcceptingClients: boolean;
  isVerified: boolean;
  socialLinks: Record<string, string>;
  showSocialLinks: boolean;
  showEmail: boolean;
  showPhone: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInstructorProfilePayload {
  displayName?: string;
  bio?: string;
  specializations?: string[];
  certifications?: InstructorCertification[];
  yearsOfExperience?: number;
  sessionTypes?: SessionType[];
  availableDays?: AvailableDay[];
  languages?: string[];
  websiteUrl?: string;
  videoIntroUrl?: string;
  maxClients?: number;
  isAcceptingClients?: boolean;
  socialLinks?: Record<string, string>;
  showSocialLinks?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
}

export interface CreateInstructorProfilePayload {
  displayName: string;
  isPublic?: boolean;
  bio?: string;
  specializations?: string[];
  certifications?: InstructorCertification[];
  yearsOfExperience?: number;
  sessionTypes?: SessionType[];
  availableDays?: AvailableDay[];
  languages?: string[];
  websiteUrl?: string;
  videoIntroUrl?: string;
  maxClients?: number;
  isAcceptingClients?: boolean;
  socialLinks?: Record<string, string>;
  showSocialLinks?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
}
