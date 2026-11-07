import { isInAppPath, OnboardingSteps } from 'core';
import type { OnboardingState, OnboardingStep } from 'core';

/** The welcome flow's address: a full screen of its own, outside the tabs. */
export const WELCOME_URL = '/welcome';

/** Where the flow ends when nothing better is known. */
export const WELCOME_FALLBACK_URL = '/tabs/home';

/** How long app start waits for the flow's state before going straight in. */
export const WELCOME_STATE_TIMEOUT_MS = 4000;

const ALL_STEPS: readonly OnboardingStep[] = Object.values(OnboardingSteps);

/**
 * Whether entering the app should open the welcome flow: once a session, and
 * only with something left to ask. No state (a failed read) means no: the
 * person is never kept out of the app by it.
 */
export function shouldOpenWelcome(state: OnboardingState | null, shownThisSession: boolean): boolean {
  if (shownThisSession || !state) {
    return false;
  }
  return state.flow.length > 0;
}

/**
 * Where the flow returns to: an in-app address inside the tabs (an invite or a
 * notification the person was on their way to), never the flow itself or a
 * page outside the app.
 */
export function welcomeReturnUrl(raw: string | null | undefined): string {
  if (!isInAppPath(raw) || !raw.startsWith('/tabs')) {
    return WELCOME_FALLBACK_URL;
  }
  return raw;
}

/** The steps a link asks for (`?steps=INTERESTS,LEVEL`), known ones only, in order, once each. */
export function parseWelcomeSteps(raw: string | null | undefined): OnboardingStep[] {
  if (!raw) {
    return [];
  }
  const asked = raw.split(',').map((part) => part.trim());
  return ALL_STEPS.filter((step) => asked.includes(step));
}

/** The flow opened on some steps only (a Home card, an Account row), coming back to `returnUrl`. */
export function welcomeLink(
  steps: readonly OnboardingStep[],
  returnUrl: string,
): { path: string; queryParams: Record<string, string> } {
  return {
    path: WELCOME_URL,
    queryParams: { steps: steps.join(','), returnUrl },
  };
}

/** The same state with these steps taken off both Home cards: a closed card disappears at once. */
export function withoutCardSteps(
  state: OnboardingState,
  steps: readonly OnboardingStep[],
): OnboardingState {
  return {
    ...state,
    trainCard: state.trainCard.filter((step) => !steps.includes(step)),
    coachCard: state.coachCard.filter((step) => !steps.includes(step)),
  };
}
