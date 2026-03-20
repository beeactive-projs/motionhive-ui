export const Genders = {
  Male: 'MALE',
  Female: 'FEMALE',
  Other: 'OTHER',
  PreferNotToSay: 'PREFER_NOT_TO_SAY',
} as const;

export type Gender = (typeof Genders)[keyof typeof Genders];

export const GenderLabels: Record<Gender, string> = {
  [Genders.Male]: 'Male',
  [Genders.Female]: 'Female',
  [Genders.Other]: 'Other',
  [Genders.PreferNotToSay]: 'Prefer not to say',
};

export const FitnessLevels = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
} as const;

export type FitnessLevel = (typeof FitnessLevels)[keyof typeof FitnessLevels];

export const FitnessLevelLabels: Record<FitnessLevel, string> = {
  [FitnessLevels.Beginner]: 'Beginner',
  [FitnessLevels.Intermediate]: 'Intermediate',
  [FitnessLevels.Advanced]: 'Advanced',
};

export const GoalCategories = {
  WeightLoss: 'WEIGHT_LOSS',
  MuscleGain: 'MUSCLE_GAIN',
  Endurance: 'ENDURANCE',
  Flexibility: 'FLEXIBILITY',
  Strength: 'STRENGTH',
  General: 'GENERAL',
} as const;

export type GoalCategory = (typeof GoalCategories)[keyof typeof GoalCategories];

export const GoalStatuses = {
  Active: 'ACTIVE',
  Completed: 'COMPLETED',
  Paused: 'PAUSED',
} as const;

export type GoalStatus = (typeof GoalStatuses)[keyof typeof GoalStatuses];

export const SessionTypes = {
  Online: 'ONLINE',
  InPerson: 'IN_PERSON',
  Hybrid: 'HYBRID',
} as const;

export type SessionType = (typeof SessionTypes)[keyof typeof SessionTypes];

export const AvailableDays = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
} as const;

export type AvailableDay = (typeof AvailableDays)[keyof typeof AvailableDays];
