import { Routes } from '@angular/router';

export const instructorRoutes: Routes = [
  // Coaching
  {
    path: 'overview',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'pageTitle.overview',
  },
  // The roster is a lens on /coaching/clients now, not a page. Kept as a
  // redirect so existing links and bookmarks still land somewhere useful.
  {
    path: 'roster',
    redirectTo: 'clients',
    pathMatch: 'full',
  },
  {
    path: 'clients',
    loadComponent: () => import('./clients/clients').then((m) => m.Clients),
    title: 'pageTitle.clients',
  },
  {
    path: 'clients/:id',
    loadComponent: () =>
      import('./clients/client-profile/client-profile').then((m) => m.ClientProfile),
    title: 'pageTitle.clientProfile',
  },
  {
    path: 'pending-requests',
    loadComponent: () =>
      import('./clients/pending-requests/pending-requests').then((m) => m.PendingRequests),
    title: 'pageTitle.pendingRequests',
  },
  {
    path: 'sessions',
    loadComponent: () => import('./sessions/sessions').then((m) => m.Sessions),
    title: 'pageTitle.manageSessions',
  },
  {
    path: 'sessions/calendar',
    loadComponent: () => import('./sessions/calendar/calendar').then((m) => m.SessionsCalendar),
    title: 'pageTitle.sessionsCalendar',
  },
  {
    path: 'sessions/approvals',
    loadComponent: () =>
      import('./sessions/approvals/approvals').then((m) => m.InstructorApprovals),
    title: 'pageTitle.approvals',
  },
  {
    path: 'sessions/templates/:id',
    loadComponent: () =>
      import('./sessions/template-detail/template-detail').then((m) => m.InstructorTemplateDetail),
    title: 'pageTitle.recurringSession',
  },
  {
    path: 'sessions/:id/attendance',
    loadComponent: () =>
      import('./sessions/attendance/attendance').then((m) => m.InstructorAttendance),
    title: 'pageTitle.attendance',
  },
  {
    path: 'sessions/:id',
    loadComponent: () =>
      import('./sessions/session-detail/session-detail').then((m) => m.InstructorSessionDetail),
    title: 'pageTitle.session',
  },
  {
    path: 'exercises',
    loadComponent: () => import('./exercises/exercises').then((m) => m.Exercises),
    title: 'pageTitle.exercises',
  },
  {
    path: 'programs',
    loadComponent: () => import('./programs/programs').then((m) => m.Programs),
    title: 'pageTitle.programs',
  },
  {
    path: 'programs/:id',
    loadComponent: () =>
      import('./programs/program-detail/program-detail').then(
        (m) => m.ProgramDetail,
      ),
    title: 'pageTitle.programDetail',
  },
  // Groups now live at the shared /groups path so all roles can access them.
  // Keep redirects so existing /coaching/groups bookmarks and in-app links still resolve.
  { path: 'groups', redirectTo: '/groups', pathMatch: 'full' },
  { path: 'groups/:id', redirectTo: '/groups/:id' },
  // // Payments hub — tabbed view at /coaching/payments?tab=...
  // {
  //   path: 'payments',
  //   loadComponent: () => import('./payments/payments').then((m) => m.Payments),
  //   title: 'pageTitle.payments',
  // },

  {
    path: '',
    loadChildren: () => import('./payments/payment.routes').then((m) => m.paymentsRoutes),
  },

  // {
  //   path: 'invoices/:id',
  //   loadComponent: () =>
  //     import('./payments/invoices/invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
  //   title: 'pageTitle.invoiceDetails',
  // },
  // {
  //   path: 'onboarding/return',
  //   loadComponent: () =>
  //     import('./payments/onboarding-return/onboarding-return').then((m) => m.OnboardingReturn),
  //   title: 'pageTitle.onboarding',
  // },
  // {
  //   path: 'onboarding/refresh',
  //   loadComponent: () =>
  //     import('./payments/onboarding-refresh/onboarding-refresh').then((m) => m.OnboardingRefresh),
  //   title: 'pageTitle.onboarding',
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
