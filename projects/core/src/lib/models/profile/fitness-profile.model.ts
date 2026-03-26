import type { Gender, FitnessLevel, GoalCategory, GoalStatus } from './profile.enums';

export interface FitnessGoal {
  id: string;
  title: string;
  category: GoalCategory;
  status: GoalStatus;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurement {
  id: string;
  recordedAt: string;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
}

export interface FitnessProfile {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  fitnessLevel: FitnessLevel | null;
  goals: FitnessGoal[];
  measurements: BodyMeasurement[];
  medicalConditions: string[] | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateFitnessProfilePayload {
  dateOfBirth?: string;
  gender?: Gender;
  heightCm?: number;
  weightKg?: number;
  fitnessLevel?: FitnessLevel;
  goals?: Pick<FitnessGoal, 'title' | 'category' | 'targetDate' | 'notes'>[];
  medicalConditions?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

export interface CreateBodyMeasurementPayload {
  recordedAt?: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number;
  notes?: string;
}

export interface CreateFitnessGoalPayload {
  title: string;
  category: GoalCategory;
  targetDate?: string;
  notes?: string;
}

export interface UpdateFitnessGoalPayload {
  title?: string;
  category?: GoalCategory;
  status?: GoalStatus;
  targetDate?: string;
  notes?: string;
}
