import { describe, expect, it } from 'vitest';

import type { Category, OnboardingState, PickedLocation } from 'core';

import { ROLES } from '../../_shared/config/roles.config';
import {
  LEVEL_CHOICES,
  MAX_OTHER_WORDS,
  MAX_OTHER_WORD_LENGTH,
  ROLE_CHOICES,
  WELCOME_COPY,
  WELCOME_ICONS,
  canGoBack,
  categoriesNamed,
  categoryNames,
  coachDetailsPayload,
  needsCategories,
  remainingSteps,
  welcomeProgress,
} from './welcome.config';

function state(flow: OnboardingState['flow']): OnboardingState {
  return {
    flowVersion: 1,
    role: null,
    steps: {
      ROLE: null,
      INTERESTS: null,
      LEVEL: null,
      COACH_CATEGORIES: null,
      COACH_DETAILS: null,
    },
    flow,
    trainCard: [],
    coachCard: [],
    interestIds: [],
    fitnessLevel: null,
    coachCategoryIds: [],
  };
}

const place = (overrides: Partial<PickedLocation> = {}): PickedLocation => ({
  displayName: 'Cluj-Napoca, Romania',
  line1: null,
  city: 'Cluj-Napoca',
  region: null,
  postalCode: null,
  countryCode: 'ro',
  country: 'Romania',
  latitude: null,
  longitude: null,
  ...overrides,
});

describe('welcome copy and choices', () => {
  it('has a heading and an intro for every step', () => {
    for (const step of ['ROLE', 'INTERESTS', 'LEVEL', 'COACH_CATEGORIES', 'COACH_DETAILS'] as const) {
      expect(WELCOME_COPY[step].title).toMatch(/^welcome\./);
      expect(WELCOME_COPY[step].intro).toMatch(/^welcome\./);
    }
  });

  it('offers training first and every level once', () => {
    expect(ROLE_CHOICES.map((choice) => choice.role)).toEqual(['TRAIN', 'COACH']);
    expect(LEVEL_CHOICES.map((choice) => choice.level)).toEqual([
      'BEGINNER',
      'INTERMEDIATE',
      'ADVANCED',
    ]);
  });

  it('registers every icon it names', () => {
    const registered = new Set(
      Object.keys(WELCOME_ICONS).map((name) =>
        name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      ),
    );
    for (const choice of ROLE_CHOICES) {
      expect(registered.has(choice.icon)).toBe(true);
    }
    // The category list's failure state.
    expect(registered.has('alert-circle-outline')).toBe(true);
  });

  it('draws each role as the role pill does', () => {
    expect(ROLE_CHOICES.map((choice) => [choice.icon, choice.color])).toEqual([
      [ROLES.train.icon, ROLES.train.color],
      [ROLES.coach.icon, ROLES.coach.color],
    ]);
  });
});

describe('needsCategories', () => {
  it('holds back the steps that pick from the category list', () => {
    expect(needsCategories('INTERESTS')).toBe(true);
    expect(needsCategories('LEVEL')).toBe(true);
    expect(needsCategories('COACH_CATEGORIES')).toBe(true);
    expect(needsCategories('ROLE')).toBe(false);
    expect(needsCategories('COACH_DETAILS')).toBe(false);
    expect(needsCategories(null)).toBe(false);
  });
});

const category = (overrides: Partial<Category>): Category => ({
  id: 'id',
  slug: 'slug',
  kind: 'ACTIVITY',
  name: 'Name',
  icon: 'barbell-outline',
  displayOrder: 1,
  coachesOnly: false,
  ...overrides,
});

describe('the coach’s own words', () => {
  const list = [
    category({ id: 'strength', name: 'Antrenament de forță', originalName: 'Strength training' }),
    category({ id: 'yoga', name: 'Yoga' }),
  ];

  it('keeps to the API’s caps', () => {
    expect(MAX_OTHER_WORDS).toBe(10);
    expect(MAX_OTHER_WORD_LENGTH).toBe(50);
  });

  it('names every category in the reader’s language and in English', () => {
    expect(categoryNames(list)).toEqual(['Antrenament de forță', 'Strength training', 'Yoga']);
  });

  it('finds the categories a word only repeats, case and accents aside', () => {
    expect(categoriesNamed(['antrenament de forta', 'YOGA'], list)).toEqual(['strength', 'yoga']);
    expect(categoriesNamed(['strength training'], list)).toEqual(['strength']);
    expect(categoriesNamed(['Kettlebells'], list)).toEqual([]);
  });
});

describe('remainingSteps', () => {
  it('follows the state when the flow opened by itself', () => {
    expect(remainingSteps(state(['ROLE', 'INTERESTS', 'LEVEL']), null, null)).toEqual([
      'ROLE',
      'INTERESTS',
      'LEVEL',
    ]);
    // Once the role is answered as a coach, the state has the coach steps.
    expect(
      remainingSteps(state(['COACH_CATEGORIES', 'COACH_DETAILS']), null, 'ROLE'),
    ).toEqual(['COACH_CATEGORIES', 'COACH_DETAILS']);
  });

  it('walks the picked steps in order, answered or not', () => {
    const picked = ['INTERESTS', 'LEVEL'] as const;
    expect(remainingSteps(state([]), picked, null)).toEqual(['INTERESTS', 'LEVEL']);
    expect(remainingSteps(state([]), picked, 'INTERESTS')).toEqual(['LEVEL']);
    expect(remainingSteps(state([]), picked, 'LEVEL')).toEqual([]);
  });
});

describe('welcomeProgress and canGoBack', () => {
  it('counts what was seen and what is left', () => {
    expect(welcomeProgress(['ROLE'], ['INTERESTS', 'LEVEL'])).toEqual({ position: 1, total: 3 });
    expect(welcomeProgress(['ROLE', 'INTERESTS'], ['LEVEL'])).toEqual({ position: 2, total: 3 });
  });

  it('goes back between answers, never to the role question', () => {
    expect(canGoBack(['INTERESTS'])).toBe(false);
    expect(canGoBack(['ROLE', 'INTERESTS'])).toBe(false);
    expect(canGoBack(['ROLE', 'INTERESTS', 'LEVEL'])).toBe(true);
  });
});

describe('coachDetailsPayload', () => {
  it('sends the picked city and country, and the switch only when it moved', () => {
    expect(coachDetailsPayload(place(), true, true)).toEqual({
      city: 'Cluj-Napoca',
      countryCode: 'RO',
    });
    expect(coachDetailsPayload(null, false, true)).toEqual({ isAcceptingClients: false });
  });

  it('sends no place without a city', () => {
    expect(coachDetailsPayload(place({ city: null }), true, true)).toEqual({});
  });
});
