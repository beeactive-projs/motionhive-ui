import { Routes } from '@angular/router';
import { authGuard, rolesGuard, UserRoles } from 'core';

/**
 * Admin app routes. Everything except the login page sits behind
 * `authGuard` + a roles gate admitting ADMIN and SUPER_ADMIN (the
 * single `adminGuard` from core only checks ADMIN, so we use the
 * `rolesGuard(...)` factory to admit both). Destructive surfaces are
 * additionally narrowed to SUPER_ADMIN at the API layer.
 */
export const routes: Routes = [
  // Login lives at `auth/login` to match core's guards, which redirect
  // unauthenticated/under-privileged users to `/auth/login` (and `/home`).
  {
    path: 'auth/login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Admin · Sign in',
  },
  // Core's role guard sends wrong-role users to `/home`; route it back to
  // the admin login so a non-admin session can't loop on a missing route.
  { path: 'home', redirectTo: 'auth/login' },
  {
    path: '',
    canActivate: [authGuard, rolesGuard(UserRoles.Admin, UserRoles.SuperAdmin)],
    loadComponent: () =>
      import('./layout/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Admin · Dashboard',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users').then((m) => m.Users),
        title: 'Admin · Users',
      },
      {
        path: 'operations',
        loadComponent: () =>
          import('./pages/operations/operations').then((m) => m.Operations),
        title: 'Admin · Operations',
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/payments/payments').then((m) => m.Payments),
        title: 'Admin · Payments',
      },
      {
        path: 'database',
        loadComponent: () =>
          import('./pages/database/database').then((m) => m.Database),
        title: 'Admin · Database',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
