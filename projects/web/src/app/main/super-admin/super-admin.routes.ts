import { Routes } from '@angular/router';

export const superAdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./super-admin').then((m) => m.SuperAdmin),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'users',
        loadComponent: () => import('./users/users').then((m) => m.Users),
        title: 'Users - MotionHive',
      },
      {
        path: 'groups',
        loadComponent: () => import('./groups/groups').then((m) => m.Groups),
        title: 'Groups - MotionHive',
      },
      {
        path: 'profile',
        loadComponent: () => import('../profile/profile').then((m) => m.Profile),
        title: 'My Profile - MotionHive',
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
