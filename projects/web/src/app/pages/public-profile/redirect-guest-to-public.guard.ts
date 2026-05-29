import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Catches guests on the in-app URL `/@<handle>` and redirects them to
 * the canonical public share-target URL `/public/@<handle>`. Paired with
 * `guestOnlyMatchGuard` on the top-level route so authed users skip this
 * branch entirely and fall through to the in-`main` route that renders
 * inside `SidenavLayout`.
 */
export const redirectGuestToPublicGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const handle = route.paramMap.get('handle') ?? '';
  return router.parseUrl(`/public/@${handle}`);
};
