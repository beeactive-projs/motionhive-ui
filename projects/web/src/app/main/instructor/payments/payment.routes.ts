import { Routes } from '@angular/router';

export const paymentsRoutes: Routes = [
  {
    path: 'payments',
    loadComponent: () => import('./payments').then((m) => m.Payments),
    title: 'pageTitle.payments',
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./invoices/invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
    title: 'pageTitle.invoiceDetails',
  },
  {
    path: 'subscriptions/:id',
    loadComponent: () =>
      import('./subscriptions/subscription-detail/subscription-detail').then(
        (m) => m.SubscriptionDetail,
      ),
    title: 'pageTitle.membershipDetails',
  },
  {
    path: 'onboarding/return',
    loadComponent: () =>
      import('./onboarding-return/onboarding-return').then((m) => m.OnboardingReturn),
    title: 'pageTitle.onboarding',
  },
  {
    path: 'onboarding/refresh',
    loadComponent: () =>
      import('./onboarding-refresh/onboarding-refresh').then((m) => m.OnboardingRefresh),
    title: 'pageTitle.onboarding',
  },
];
