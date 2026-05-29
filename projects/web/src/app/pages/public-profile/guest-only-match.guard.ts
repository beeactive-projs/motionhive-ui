import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthStore } from 'core';

/**
 * `CanMatchFn` used by the top-level `/@:handle` route in `app.routes.ts`.
 *
 * Returns `true` for unauthenticated visitors so the guest page wrapper
 * (`PublicProfilePage` under `pages/public-profile/`) renders.
 *
 * Returns `false` for authenticated users so Angular falls through to the
 * next matching route — which is the in-`main` registration under
 * `SidenavLayout`, giving authed users the existing sidenav-wrapped view.
 *
 * One canonical URL, two layouts, no redirect needed.
 */
export const guestOnlyMatchGuard: CanMatchFn = () => {
  const authStore = inject(AuthStore);
  return !authStore.isAuthenticated();
};
