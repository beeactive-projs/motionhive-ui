import { CanActivateChildFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { APP_HOME_URL } from '../constants/app-urls.const';
import { TokenService } from '../services/auth/token.service';
import { resolveReturnUrl } from '../utils/url.utils';

/**
 * Keeps signed-in users off the guest pages (sign in, sign up, password reset
 * request): they go to `returnUrl` when it is an in-app path, else to the
 * app's home (`APP_HOME_URL`).
 *
 * Links that carry a `token` (client invite, password reset, email
 * verification) pass through: they are one-shot actions the page has to run
 * whoever is signed in.
 */
export const guestGuard: CanActivateChildFn = (route) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const homeUrl = inject(APP_HOME_URL);

  if (!tokenService.getAccessToken() || route.queryParamMap.has('token')) {
    return true;
  }

  return router.parseUrl(resolveReturnUrl(route.queryParamMap, homeUrl));
};
