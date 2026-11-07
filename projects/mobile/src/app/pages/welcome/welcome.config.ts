import { FitnessLevels, OnboardingRoles, OnboardingSteps, foldForSearch } from 'core';
import type {
  FitnessLevel,
  OnboardingRole,
  OnboardingState,
  OnboardingStep,
  PickedLocation,
  SetCoachDetailsPayload,
} from 'core';
import {
  arrowBackOutline,
  barbellOutline,
  checkmarkOutline,
  closeOutline,
  locationOutline,
  peopleOutline,
} from 'ionicons/icons';


/** The glyphs the flow draws beside the categories' own (`CATEGORY_ICONS`). */
export const WELCOME_ICONS = {
  arrowBackOutline,
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
  icon: string;
  /** The role's hue, as the role pill and the switch-role page paint it. */
  color: string;
}

/** Train first: most people who sign up are here to train. */
export const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: OnboardingRoles.Train,
    label: 'welcome.role.train.label',
    detail: 'welcome.role.train.detail',
    icon: 'barbell-outline',
    color: 'secondary',
  },
  {
    role: OnboardingRoles.Coach,
    label: 'welcome.role.coach.label',
    detail: 'welcome.role.coach.detail',
    icon: 'people-outline',
    color: 'primary',
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
 * "Kettlebells, calisthenics" as the words to add: split on commas, trimmed,
 * each once (blind to case and accents), cut to the API's caps.
 */
export function splitOtherWords(text: string): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(',')) {
    const word = part.trim().slice(0, MAX_OTHER_WORD_LENGTH).trim();
    const key = foldForSearch(word);
    if (word === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    words.push(word);
    if (words.length === MAX_OTHER_WORDS) {
      break;
    }
  }
  return words;
}

/** Adds or removes one id, keeping the rest in the order they were picked. */
export function toggleId(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids.filter((existing) => existing !== id);
  }
  return [...ids, id];
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
