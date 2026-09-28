import { enumLabelMap } from '../../i18n/enum-label';

export const Genders = {
  Male: 'MALE',
  Female: 'FEMALE',
  Other: 'OTHER',
  PreferNotToSay: 'PREFER_NOT_TO_SAY',
} as const;

export type Gender = (typeof Genders)[keyof typeof Genders];

export const GenderLabels: Record<Gender, string> = enumLabelMap('gender', Object.values(Genders));

export const FitnessLevels = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
} as const;

export type FitnessLevel = (typeof FitnessLevels)[keyof typeof FitnessLevels];

export const FitnessLevelLabels: Record<FitnessLevel, string> = enumLabelMap(
  'fitnessLevel',
  Object.values(FitnessLevels),
);

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

/**
 * How a coach delivers their training — a profile-level preference, not the
 * session domain's `SessionType` (GROUP/PRIVATE/OPEN). Named "format" so the
 * two can never collide; the API field is still `sessionTypes`.
 */
export const SessionFormats = {
  Online: 'ONLINE',
  InPerson: 'IN_PERSON',
  Hybrid: 'HYBRID',
} as const;

export type SessionFormat = (typeof SessionFormats)[keyof typeof SessionFormats];

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

/**
 * Per-field visibility level on a public profile. PUBLIC = everyone,
 * COACHES_ONLY = the owner's active coaches + the owner, ONLY_ME =
 * just the owner. Mirrors `ProfilePrivacyLevel` on the API.
 */
export const ProfilePrivacy = {
  Public: 'PUBLIC',
  CoachesOnly: 'COACHES_ONLY',
  OnlyMe: 'ONLY_ME',
} as const;

export type ProfilePrivacy =
  (typeof ProfilePrivacy)[keyof typeof ProfilePrivacy];

export const ProfilePrivacyLabels: Record<ProfilePrivacy, string> = enumLabelMap(
  'profilePrivacy',
  Object.values(ProfilePrivacy),
);

export const ProfilePrivacyIcons: Record<ProfilePrivacy, string> = {
  [ProfilePrivacy.Public]: 'pi pi-globe',
  [ProfilePrivacy.CoachesOnly]: 'pi pi-users',
  [ProfilePrivacy.OnlyMe]: 'pi pi-lock',
};

/** Selectable order for the privacy chooser dropdown (most → least open). */
export const ProfilePrivacyOptions: readonly ProfilePrivacy[] = [
  ProfilePrivacy.Public,
  ProfilePrivacy.CoachesOnly,
  ProfilePrivacy.OnlyMe,
] as const;
