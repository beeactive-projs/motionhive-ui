import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';

export const userRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard - MotionHive',
  },
  {
    // Legacy path. Coaches now live in the profile "Coaches" tab.
    path: 'instructors',
    canActivate: [
      (): UrlTree =>
        inject(Router).createUrlTree(['/profile'], { queryParams: { tab: 'coaches' } }),
    ],
    children: [],
  },
];
