import { FitnessLevels, NavModes, OnboardingRoles, OnboardingSteps } from 'core';
import type {
  Category,
  FitnessLevel,
  OnboardingRole,
  OnboardingState,
  OnboardingStep,
  PickedLocation,
  SetCoachDetailsPayload,
} from 'core';
import {
  alertCircleOutline,
  barbellOutline,
  checkmarkOutline,
  closeOutline,
  locationOutline,
  peopleOutline,
} from 'ionicons/icons';

import { chipKey } from '../../_shared/components/chip-input/chip-input.config';
import { ROLES } from '../../_shared/config/roles.config';

/** The glyphs the flow draws beside the categories' own (`CATEGORY_ICONS`). */
export const WELCOME_ICONS = {
  alertCircleOutline,
  barbellOutline,
  checkmarkOutline,
  closeOutline,
  locationOutline,
  peopleOutline,
};

/** Each step's heading and the line under it. */
export const WELCOME_COPY: Readonly<Record<OnboardingStep, { title: string; intro: string }>> = {
  [OnboardingSteps.Role]: { title: 'welcome.role.title', intro: 'welcome.role.intro' },
  [OnboardingSteps.Interests]: {
    title: 'welcome.interests.title',
    intro: 'welcome.interests.intro',
  },
  [OnboardingSteps.Level]: { title: 'welcome.level.title', intro: 'welcome.level.intro' },
  [OnboardingSteps.CoachCategories]: {
    title: 'welcome.coachCategories.title',
    intro: 'welcome.coachCategories.intro',
  },
  [OnboardingSteps.CoachDetails]: {
    title: 'welcome.coachDetails.title',
    intro: 'welcome.coachDetails.intro',
  },
};

export interface RoleChoice {
  role: OnboardingRole;
  label: string;
  detail: string;
  /** The role's glyph and hue, as the role pill and the switch-role page draw it (`ROLES`). */
  icon: string;
  color: string;
}

/** Train first: most people who sign up are here to train. */
export const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: OnboardingRoles.Train,
    label: 'welcome.role.train.label',
    detail: 'welcome.role.train.detail',
    icon: ROLES[NavModes.Train].icon,
    color: ROLES[NavModes.Train].color,
  },
  {
    role: OnboardingRoles.Coach,
    label: 'welcome.role.coach.label',
    detail: 'welcome.role.coach.detail',
    icon: ROLES[NavModes.Coach].icon,
    color: ROLES[NavModes.Coach].color,
  },
];

export interface LevelChoice {
  level: FitnessLevel;
  label: string;
  detail: string;
}

export const LEVEL_CHOICES: readonly LevelChoice[] = [
  {
    level: FitnessLevels.Beginner,
    label: 'welcome.level.beginner.label',
    detail: 'welcome.level.beginner.detail',
  },
  {
    level: FitnessLevels.Intermediate,
    label: 'welcome.level.intermediate.label',
    detail: 'welcome.level.intermediate.detail',
  },
  {
    level: FitnessLevels.Advanced,
    label: 'welcome.level.advanced.label',
    detail: 'welcome.level.advanced.detail',
  },
];

/** The API's caps: words a coach adds in one go, and the length of each. */
export const MAX_OTHER_WORDS = 10;
export const MAX_OTHER_WORD_LENGTH = 50;

/**
 * Every name the categories go by here: the name in the reader's language
 * and the English one. A coach's own word that only repeats one is left to
 * the category (the API drops it too), so the chip field leaves these out.
 */
export function categoryNames(categories: readonly Category[]): string[] {
  const names: string[] = [];
  for (const category of categories) {
    names.push(category.name);
    if (category.originalName) {
      names.push(category.originalName);
    }
  }
  return names;
}

/** The ids of the categories `words` name, in the list's order, case and accents aside. */
export function categoriesNamed(
  words: readonly string[],
  categories: readonly Category[],
): string[] {
  const keys = new Set(words.map(chipKey));
  const ids: string[] = [];
  for (const category of categories) {
    if (keys.has(chipKey(category.name))) {
      ids.push(category.id);
    } else if (category.originalName && keys.has(chipKey(category.originalName))) {
      ids.push(category.id);
    }
  }
  return ids;
}

/**
 * The steps that pick from the category list, which wait for it. Interests
 * and Level build their save from it (each kind saves its own), so saved
 * before it came they would send nothing and wipe what the person had; the
 * coach's step has nothing to pick until then.
 */
const CATEGORY_STEPS: readonly OnboardingStep[] = [
  OnboardingSteps.Interests,
  OnboardingSteps.Level,
  OnboardingSteps.CoachCategories,
];

export function needsCategories(step: OnboardingStep | null): boolean {
  if (!step) {
    return false;
  }
  return CATEGORY_STEPS.includes(step);
}

/**
 * What is left to ask after the current step. Opened on some steps (a Home
 * card, an Account row), those steps in order; opened by itself, what the
 * state says is pending. Answering the role question always hands over to
 * the state, since a new coach has their own steps next.
 */
export function remainingSteps(
  state: OnboardingState,
  picked: readonly OnboardingStep[] | null,
  current: OnboardingStep | null,
): OnboardingStep[] {
  if (picked) {
    const index = current ? picked.indexOf(current) : -1;
    return picked.slice(index + 1);
  }
  return state.flow.filter((step) => step !== current);
}

/** "Step 2 of 3": the steps seen so far, this one included, plus what is left. */
export function welcomeProgress(
  seen: readonly OnboardingStep[],
  left: readonly OnboardingStep[],
): { position: number; total: number } {
  return { position: seen.length, total: seen.length + left.length };
}

/** Back goes to the step before, but never to the role question once it is answered. */
export function canGoBack(seen: readonly OnboardingStep[]): boolean {
  if (seen.length < 2) {
    return false;
  }
  return seen[seen.length - 2] !== OnboardingSteps.Role;
}

/**
 * The coach details to save: the place when one was picked (and it names a
 * city), and the taking clients switch when it moved.
 */
export function coachDetailsPayload(
  picked: PickedLocation | null,
  accepting: boolean,
  acceptingBefore: boolean,
): SetCoachDetailsPayload {
  const payload: SetCoachDetailsPayload = {};
  if (picked && picked.city) {
    payload.city = picked.city;
    if (picked.countryCode) {
      payload.countryCode = picked.countryCode.toUpperCase();
    }
  }
  if (accepting !== acceptingBefore) {
    payload.isAcceptingClients = accepting;
  }
  return payload;
}
