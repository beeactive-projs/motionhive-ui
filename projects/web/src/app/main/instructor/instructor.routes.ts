import { Routes } from '@angular/router';

export const instructorRoutes: Routes = [
  // Coaching
  {
    path: 'overview',
    loadComponent: () =>
      import('./coaching-overview/coaching-overview').then((m) => m.CoachingOverview),
    title: 'Coaching Overview - MotionHive',
  },
  {
    path: 'clients',
    loadComponent: () => import('./clients/clients').then((m) => m.Clients),
    title: 'Clients - MotionHive',
  },
  {
    path: 'sessions',
    loadComponent: () => import('./sessions/sessions').then((m) => m.Sessions),
    title: 'Sessions - MotionHive',
  },
  {
    path: 'groups',
    loadComponent: () => import('./groups/groups').then((m) => m.Groups),
    title: 'Groups - MotionHive',
  },
  {
    path: 'groups/:id',
    loadComponent: () => import('./groups/group-detail/group-detail').then((m) => m.GroupDetail),
    title: 'Group Details - MotionHive',
  },

  // Revenue
  {
    path: 'earnings',
    loadComponent: () => import('./payments/earnings/earnings').then((m) => m.Earnings),
    title: 'Earnings - MotionHive',
  },
  {
    path: 'invoices',
    loadComponent: () => import('./payments/invoices/invoices').then((m) => m.Invoices),
    title: 'Invoices - MotionHive',
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./payments/invoices/invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
    title: 'Invoice Details - MotionHive',
  },
  {
    path: 'pricing',
    loadComponent: () => import('./payments/products/products').then((m) => m.Products),
    title: 'Pricing - MotionHive',
  },
  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./payments/subscriptions/subscriptions').then((m) => m.Subscriptions),
    title: 'Subscriptions - MotionHive',
  },
  {
    path: 'onboarding/return',
    loadComponent: () =>
      import('./payments/onboarding-return/onboarding-return').then((m) => m.OnboardingReturn),
    title: 'Onboarding - MotionHive',
  },
  {
    path: 'onboarding/refresh',
    loadComponent: () =>
      import('./payments/onboarding-refresh/onboarding-refresh').then((m) => m.OnboardingRefresh),
    title: 'Onboarding - MotionHive',
  },
];
