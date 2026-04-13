import { Routes } from '@angular/router';
import { authGuard } from 'core';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'error',
    loadChildren: () => import('./pages/error/error.routes').then((m) => m.errorRoutes),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadChildren: () => import('./main/main.routes').then((m) => m.mainRoutes),
  },

  // Legacy redirects — keep old links alive
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'app/home' },
  { path: 'clients', pathMatch: 'full', redirectTo: 'app/coaching/clients' },
  { path: 'groups', pathMatch: 'full', redirectTo: 'app/coaching/groups' },
  { path: 'groups/:id', redirectTo: 'app/coaching/groups/:id' },
  { path: 'payments', pathMatch: 'full', redirectTo: 'app/coaching/earnings' },
  { path: 'payments/products', pathMatch: 'full', redirectTo: 'app/coaching/pricing' },
  { path: 'payments/invoices', pathMatch: 'full', redirectTo: 'app/coaching/invoices' },
  { path: 'payments/invoices/:id', redirectTo: 'app/coaching/invoices/:id' },
  { path: 'payments/subscriptions', pathMatch: 'full', redirectTo: 'app/coaching/subscriptions' },
  { path: 'payments/earnings', pathMatch: 'full', redirectTo: 'app/coaching/earnings' },
  { path: 'payments/onboarding/return', pathMatch: 'full', redirectTo: 'app/coaching/onboarding/return' },
  { path: 'payments/onboarding/refresh', pathMatch: 'full', redirectTo: 'app/coaching/onboarding/refresh' },
  { path: 'user/dashboard', pathMatch: 'full', redirectTo: 'app/home' },
  { path: 'user/instructors', pathMatch: 'full', redirectTo: 'app/explore' },
  { path: 'user/invoices', pathMatch: 'full', redirectTo: 'app/activity/invoices' },
  { path: 'user/invoices/:id', redirectTo: 'app/activity/invoices/:id' },
  { path: 'user/subscriptions', pathMatch: 'full', redirectTo: 'app/activity/subscriptions' },
  { path: 'user/checkout/return', pathMatch: 'full', redirectTo: 'app/activity/checkout/return' },
  { path: 'profile', pathMatch: 'full', redirectTo: 'app/profile' },
  { path: 'join/:token', redirectTo: 'app/join/:token' },
  { path: 'writer/posts', pathMatch: 'full', redirectTo: 'app/writer/posts' },
  { path: 'writer/posts/new', pathMatch: 'full', redirectTo: 'app/writer/posts/new' },
  { path: 'writer/posts/:slug', redirectTo: 'app/writer/posts/:slug' },
  { path: 'super-admin/dashboard', pathMatch: 'full', redirectTo: 'app/super-admin/dashboard' },
  { path: 'super-admin/users', pathMatch: 'full', redirectTo: 'app/super-admin/users' },
  { path: 'super-admin/groups', pathMatch: 'full', redirectTo: 'app/super-admin/groups' },

  {
    path: '**',
    redirectTo: 'error/not-found',
  },
];
