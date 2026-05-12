import { Routes } from '@angular/router';

export const publicProfileRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public-profile').then((m) => m.PublicProfile),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'about' },
      {
        path: 'about',
        loadComponent: () => import('./tabs/about-tab/about-tab').then((m) => m.AboutTab),
      },
      {
        path: 'offerings',
        loadComponent: () =>
          import('./tabs/offerings-tab/offerings-tab').then((m) => m.OfferingsTab),
      },
      {
        path: 'groups',
        loadComponent: () => import('./tabs/groups-tab/groups-tab').then((m) => m.GroupsTab),
      },
      {
        path: 'reviews',
        loadComponent: () => import('./tabs/reviews-tab/reviews-tab').then((m) => m.ReviewsTab),
      },
    ],
  },
];
