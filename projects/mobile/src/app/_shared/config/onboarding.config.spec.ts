import { describe, expect, it } from 'vitest';

import type { OnboardingState } from 'core';

import {
  WELCOME_FALLBACK_URL,
  parseWelcomeSteps,
  shouldOpenWelcome,
  welcomeLink,
  welcomeReturnUrl,
  withoutCardSteps,
} from './onboarding.config';

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
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
    flow: ['ROLE', 'INTERESTS', 'LEVEL'],
    trainCard: [],
    coachCard: [],
    interestIds: [],
    fitnessLevel: null,
    coachCategoryIds: [],
    ...overrides,
  };
}

describe('shouldOpenWelcome', () => {
  it('opens while the flow has something to ask, once a session', () => {
    expect(shouldOpenWelcome(state(), false)).toBe(true);
    expect(shouldOpenWelcome(state(), true)).toBe(false);
  });

  it('goes straight in with nothing to ask, or with no state at all', () => {
    expect(shouldOpenWelcome(state({ flow: [] }), false)).toBe(false);
    expect(shouldOpenWelcome(null, false)).toBe(false);
  });
});

describe('welcomeReturnUrl', () => {
  it('keeps an address inside the tabs, query string and all', () => {
    expect(welcomeReturnUrl('/tabs/groups/join?token=abc')).toBe('/tabs/groups/join?token=abc');
  });

  it('falls back to Home for anything else', () => {
    expect(welcomeReturnUrl(null)).toBe(WELCOME_FALLBACK_URL);
    expect(welcomeReturnUrl('/welcome')).toBe(WELCOME_FALLBACK_URL);
    expect(welcomeReturnUrl('https://evil.example')).toBe(WELCOME_FALLBACK_URL);
    expect(welcomeReturnUrl('//evil.example/tabs')).toBe(WELCOME_FALLBACK_URL);
    expect(welcomeReturnUrl('/auth/login')).toBe(WELCOME_FALLBACK_URL);
  });
});

describe('parseWelcomeSteps', () => {
  it('reads known steps in the flow order, once each', () => {
    expect(parseWelcomeSteps('LEVEL, INTERESTS,NOPE,LEVEL')).toEqual(['INTERESTS', 'LEVEL']);
    expect(parseWelcomeSteps('')).toEqual([]);
    expect(parseWelcomeSteps(null)).toEqual([]);
  });

  it('round-trips a link', () => {
    const link = welcomeLink(['COACH_CATEGORIES', 'COACH_DETAILS'], '/tabs/home');
    expect(link.path).toBe('/welcome');
    expect(parseWelcomeSteps(link.queryParams['steps'])).toEqual([
      'COACH_CATEGORIES',
      'COACH_DETAILS',
    ]);
    expect(link.queryParams['returnUrl']).toBe('/tabs/home');
  });
});

describe('withoutCardSteps', () => {
  it('takes the steps off both cards and nothing else', () => {
    const next = withoutCardSteps(
      state({ trainCard: ['INTERESTS', 'LEVEL'], coachCard: ['COACH_DETAILS'] }),
      ['INTERESTS', 'LEVEL'],
    );
    expect(next.trainCard).toEqual([]);
    expect(next.coachCard).toEqual(['COACH_DETAILS']);
    expect(next.flow).toEqual(['ROLE', 'INTERESTS', 'LEVEL']);
  });
});
