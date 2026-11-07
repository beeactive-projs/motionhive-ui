import type { FitnessLevel } from '../profile/profile.enums';
import type {
  CategoryKind,
  OnboardingRole,
  OnboardingStep,
  OnboardingStepStatus,
} from './onboarding.enums';

/**
 * One entry of MotionHive's category list (`GET /categories`): what people
 * train and why. `name` is in the reader's language; ids differ per
 * database, so code that means one category goes by `slug`.
 */
export interface Category {
  id: string;
  slug: string;
  kind: CategoryKind;
  name: string;
  /** The English name, sent only when `name` is a translation. */
  originalName?: string;
  /** An Ionicons outline glyph. */
  icon: string;
  displayOrder: number;
  /** Offered by coaches only (nutrition): never one of a person's interests. */
  coachesOnly: boolean;
}

/**
 * `GET /users/me/onboarding`, and what every onboarding write sends back.
 * `flow` is what to ask now, in order; empty means the app goes straight in.
 */
export interface OnboardingState {
  flowVersion: number;
  /** COACH for a coach, TRAIN once answered, null before. */
  role: OnboardingRole | null;
  steps: Record<OnboardingStep, OnboardingStepStatus | null>;
  flow: OnboardingStep[];
  /** Steps the Train home offers as a card. */
  trainCard: OnboardingStep[];
  /** Steps the coach home offers as a card. */
  coachCard: OnboardingStep[];
  /** Category ids the person likes, activities and goals. */
  interestIds: string[];
  fitnessLevel: FitnessLevel | null;
  /** Category ids a coach coaches. */
  coachCategoryIds: string[];
}

export interface SetLevelPayload {
  fitnessLevel: FitnessLevel | null;
  goalIds: string[];
}

export interface SetCoachCategoriesPayload {
  categoryIds: string[];
  /** Their own words for what the list misses; added to their specializations. */
  otherSpecializations?: string[];
}

/** Only the fields sent are saved. */
export interface SetCoachDetailsPayload {
  city?: string;
  /** ISO 3166-1 alpha-2. */
  countryCode?: string;
  isAcceptingClients?: boolean;
}
