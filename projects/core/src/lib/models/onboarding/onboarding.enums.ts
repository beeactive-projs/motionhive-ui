/** ACTIVITY is what you do, GOAL is why you train. Mirrors the API's `category_kind`. */
export const CategoryKinds = {
  Activity: 'ACTIVITY',
  Goal: 'GOAL',
} as const;

export type CategoryKind = (typeof CategoryKinds)[keyof typeof CategoryKinds];

/**
 * The welcome flow's steps. Someone who trains answers ROLE, INTERESTS,
 * LEVEL; a coach answers COACH_CATEGORIES and COACH_DETAILS, with their own
 * training offered later on the Train home.
 */
export const OnboardingSteps = {
  Role: 'ROLE',
  Interests: 'INTERESTS',
  Level: 'LEVEL',
  CoachCategories: 'COACH_CATEGORIES',
  CoachDetails: 'COACH_DETAILS',
} as const;

export type OnboardingStep = (typeof OnboardingSteps)[keyof typeof OnboardingSteps];

/** What became of a step; a step with none is still pending. */
export const OnboardingStepStatuses = {
  Done: 'DONE',
  Skipped: 'SKIPPED',
  Dismissed: 'DISMISSED',
} as const;

export type OnboardingStepStatus =
  (typeof OnboardingStepStatuses)[keyof typeof OnboardingStepStatuses];

/** The answer to "How will you use MotionHive?". */
export const OnboardingRoles = {
  Train: 'TRAIN',
  Coach: 'COACH',
} as const;

export type OnboardingRole = (typeof OnboardingRoles)[keyof typeof OnboardingRoles];
