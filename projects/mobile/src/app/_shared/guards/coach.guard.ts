import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from 'core';

/**
 * Coach-only routes. Deliberately not core's `instructorGuard`: that one falls
 * through to `/home`, a route that exists on web but not here — on mobile it
 * only resolves by accident of the `**` wildcard, and would break the moment
 * that wildcard changes.
 *
 * This is deep-link defence (a push notification landing on a coach page).
 * The primary defence is the tab config: a non-instructor's tab set never
 * contains these routes in the first place.
 */
export const coachGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isInstructor()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return router.createUrlTree(['/tabs/home']);
};
