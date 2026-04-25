import { Routes } from '@angular/router';

export const paymentsRoutes: Routes = [
  {
    path: 'payments',
    loadComponent: () => import('./payments').then((m) => m.Payments),
    title: 'Payments - MotionHive',
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./invoices/invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
    title: 'Invoice Details - MotionHive',
  },
  {
    path: 'subscriptions/:id',
    loadComponent: () =>
      import('./subscriptions/subscription-detail/subscription-detail').then(
        (m) => m.SubscriptionDetail,
      ),
    title: 'Membership Details - MotionHive',
  },
  {
    path: 'onboarding/return',
    loadComponent: () =>
      import('./onboarding-return/onboarding-return').then((m) => m.OnboardingReturn),
    title: 'Onboarding - MotionHive',
  },
  {
    path: 'onboarding/refresh',
    loadComponent: () =>
      import('./onboarding-refresh/onboarding-refresh').then((m) => m.OnboardingRefresh),
    title: 'Onboarding - MotionHive',
  },
];
