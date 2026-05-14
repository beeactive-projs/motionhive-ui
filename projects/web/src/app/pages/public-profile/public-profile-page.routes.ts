import { Routes } from '@angular/router';
import { publicProfileTabRoutes } from '../../main/public-profile/public-profile.routes';

/**
 * Guest mount of the public profile. The outer `PublicProfilePage` owns
 * the slim public top bar (and, later, the signup strip), then mounts the
 * existing inner `PublicProfile` shell via the nested child route. The
 * `contact` and `share` deep-link children are reused verbatim from the
 * authed mount so both flows expose the same URL surface.
 */
export const publicProfilePageRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./public-profile-page').then((m) => m.PublicProfilePage),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../../main/public-profile/public-profile').then(
            (m) => m.PublicProfile,
          ),
        children: publicProfileTabRoutes,
      },
    ],
  },
];
