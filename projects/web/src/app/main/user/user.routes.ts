import { Routes } from '@angular/router';

export const userRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard - MotionHive',
  },
  {
    path: 'instructors',
    loadComponent: () => import('./instructors/instructors').then((m) => m.Instructors),
    title: 'My Instructors - MotionHive',
  },
];
