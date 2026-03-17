export const Genders = {
  Male: 'MALE',
  Female: 'FEMALE',
  Other: 'OTHER',
  PreferNotToSay: 'PREFER_NOT_TO_SAY',
} as const;

export type Gender = (typeof Genders)[keyof typeof Genders];

export const FitnessLevels = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
} as const;

export type FitnessLevel = (typeof FitnessLevels)[keyof typeof FitnessLevels];

export interface UserProfile {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  fitnessLevel: FitnessLevel | null;
  goals: string[];
  medicalConditions: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  specializations: string[];
  certifications: InstructorCertification[];
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  socialLinks: Record<string, string>;
  showSocialLinks: boolean;
  showEmail: boolean;
  showPhone: boolean;
  locationCity: string | null;
  locationCountry: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FullProfileResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarId: string | null;
    isActive: boolean;
    isEmailVerified: boolean;
    createdAt: string;
  };
  roles: string[];
  userProfile: UserProfile | null;
  instructorProfile: InstructorProfile | null;
}

export interface UpdateUserProfilePayload {
  dateOfBirth?: string;
  gender?: Gender;
  heightCm?: number;
  weightKg?: number;
  fitnessLevel?: FitnessLevel;
  goals?: string[];
  medicalConditions?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

export interface UpdateInstructorProfilePayload {
  displayName?: string;
  bio?: string;
  specializations?: string[];
  certifications?: InstructorCertification[];
  yearsOfExperience?: number;
  isAcceptingClients?: boolean;
  socialLinks?: Record<string, string>;
  showSocialLinks?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  locationCity?: string;
  locationCountry?: string;
}

export interface UpdateFullProfilePayload {
  user?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  userProfile?: UpdateUserProfilePayload;
  instructor?: UpdateInstructorProfilePayload;
}

export interface CreateInstructorProfilePayload {
  displayName: string;
  bio?: string;
  specializations?: string[];
}
