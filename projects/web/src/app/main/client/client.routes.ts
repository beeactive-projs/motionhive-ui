import { Routes } from '@angular/router';

export const clientRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./client').then((m) => m.Client),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - BeeActive',
      },
      {
        path: 'instructors',
        loadComponent: () => import('./instructors/instructors').then((m) => m.Instructors),
        title: 'My Instructors - BeeActive',
      },
      {
        path: 'profile',
        loadComponent: () => import('../profile/profile').then((m) => m.Profile),
        title: 'My Profile - BeeActive',
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
