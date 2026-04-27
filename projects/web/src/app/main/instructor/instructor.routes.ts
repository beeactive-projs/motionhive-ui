import { Routes } from '@angular/router';

export const instructorRoutes: Routes = [
  // Coaching
  {
    path: 'overview',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Overview - MotionHive',
  },
  {
    path: 'clients',
    loadComponent: () => import('./clients/clients').then((m) => m.Clients),
    title: 'Clients - MotionHive',
  },
  {
    path: 'clients/:id',
    loadComponent: () =>
      import('./clients/client-profile/client-profile').then((m) => m.ClientProfile),
    title: 'Client profile - MotionHive',
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
  // // Payments hub — tabbed view at /coaching/payments?tab=...
  // {
  //   path: 'payments',
  //   loadComponent: () => import('./payments/payments').then((m) => m.Payments),
  //   title: 'Payments - MotionHive',
  // },

  {
    path: '',
    loadChildren: () => import('./payments/payment.routes').then((m) => m.paymentsRoutes),
  },

  // {
  //   path: 'invoices/:id',
  //   loadComponent: () =>
  //     import('./payments/invoices/invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
  //   title: 'Invoice Details - MotionHive',
  // },
  // {
  //   path: 'onboarding/return',
  //   loadComponent: () =>
  //     import('./payments/onboarding-return/onboarding-return').then((m) => m.OnboardingReturn),
  //   title: 'Onboarding - MotionHive',
  // },
  // {
  //   path: 'onboarding/refresh',
  //   loadComponent: () =>
  //     import('./payments/onboarding-refresh/onboarding-refresh').then((m) => m.OnboardingRefresh),
  //   title: 'Onboarding - MotionHive',
  // },
  // Legacy redirects — simple path redirects to the hub.
  // The hub defaults to the Invoices tab. Query-param redirects
  // aren't supported by Angular router, so bookmarks go to the
  // hub root and users pick the tab from there.
  // { path: 'earnings', redirectTo: 'payments', pathMatch: 'full' },
  // { path: 'invoices', redirectTo: 'payments', pathMatch: 'full' },
  // { path: 'pricing', redirectTo: 'payments', pathMatch: 'full' },
  // { path: 'subscriptions', redirectTo: 'payments', pathMatch: 'full' },
];
