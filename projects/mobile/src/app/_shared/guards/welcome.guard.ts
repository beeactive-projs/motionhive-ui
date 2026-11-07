import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from 'core';

import { shouldOpenWelcome, WELCOME_URL } from '../config/onboarding.config';
import { OnboardingStateService } from '../services/onboarding-state.service';

/**
 * Opens the welcome flow on the way into the app, once a session, while it
 * has something to ask. The address the person was going to (an invite, a
 * notification) rides along as `returnUrl`, so the flow ends there.
 *
 * Signed out is `authGuard`'s to handle: asking the API without a token
 * would only start a refresh that sends the person to sign in twice.
 */
export const welcomeGuard: CanActivateFn = async (_route, routerState) => {
  const tokenService = inject(TokenService);
  const onboarding = inject(OnboardingStateService);
  const router = inject(Router);

  if (!tokenService.getAccessToken() || onboarding.shownThisSession()) {
    return true;
  }

  const state = await onboarding.ensureLoaded();
  if (!shouldOpenWelcome(state, onboarding.shownThisSession())) {
    return true;
  }
  return router.createUrlTree([WELCOME_URL], {
    queryParams: { returnUrl: routerState.url },
  });
};
