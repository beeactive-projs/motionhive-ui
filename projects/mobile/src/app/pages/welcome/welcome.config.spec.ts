import { describe, expect, it } from 'vitest';

import type { OnboardingState, PickedLocation } from 'core';

import {
  LEVEL_CHOICES,
  MAX_OTHER_WORDS,
  ROLE_CHOICES,
  WELCOME_COPY,
  WELCOME_ICONS,
  canGoBack,
  coachDetailsPayload,
  remainingSteps,
  splitOtherWords,
  toggleId,
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
  });
});

describe('splitOtherWords', () => {
  it('splits on commas, trims and keeps each word once', () => {
    expect(splitOtherWords(' Kettlebells, calistenie ,, kettlebells, Calistenie ')).toEqual([
      'Kettlebells',
      'calistenie',
    ]);
    expect(splitOtherWords('Forță, forta')).toEqual(['Forță']);
    expect(splitOtherWords('')).toEqual([]);
  });

  it('stops at the API caps', () => {
    const many = Array.from({ length: 15 }, (_, index) => `word${index}`).join(',');
    expect(splitOtherWords(many)).toHaveLength(MAX_OTHER_WORDS);
    expect(splitOtherWords('x'.repeat(80))[0]).toHaveLength(50);
  });
});

describe('toggleId', () => {
  it('adds and removes, keeping the picking order', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
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
