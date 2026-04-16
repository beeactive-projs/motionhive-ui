import { Routes } from '@angular/router';

export const superAdminRoutes: Routes = [
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
];
