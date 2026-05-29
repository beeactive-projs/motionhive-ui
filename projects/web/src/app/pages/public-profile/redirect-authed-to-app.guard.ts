import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from 'core';

/**
 * Catches authenticated users on the canonical share-target URL
 * `/public/@<handle>` and redirects them to the in-app URL `/@<handle>`
 * so they get the `SidenavLayout`-wrapped experience instead of the slim
 * public chrome. Guests pass through and see the public page as designed.
 */
export const redirectAuthedToAppGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  if (!authStore.isAuthenticated()) return true;
  const handle = route.paramMap.get('handle') ?? '';
  return router.parseUrl(`/@${handle}`);
};
