import { Routes } from '@angular/router';

export const activityRoutes: Routes = [
  {
    path: 'schedule',
    loadComponent: () => import('./schedule/schedule').then((m) => m.Schedule),
    title: 'My Schedule - MotionHive',
  },
  {
    path: 'progress',
    loadComponent: () => import('./progress/progress').then((m) => m.Progress),
    title: 'My Progress - MotionHive',
  },
  {
    path: 'checkout/return',
    loadComponent: () =>
      import('./payments/checkout-return/checkout-return').then((m) => m.CheckoutReturn),
    title: 'Payment - MotionHive',
  },
  // Legacy — redirect personal billing pages to the profile hub
  { path: 'invoices', redirectTo: '/profile', pathMatch: 'full' },
  { path: 'subscriptions', redirectTo: '/profile', pathMatch: 'full' },
];
