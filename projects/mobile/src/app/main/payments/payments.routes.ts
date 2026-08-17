import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';

/**
 * Two areas, two addresses, both under `home` so the Home tab stays lit.
 *
 * Payments gets no tab for either role: the coach chases money deliberately
 * (a visit, not an interruption) and a client's bill is rare enough that a
 * permanent tab would sit empty. They are separate route trees rather than one
 * mode-switching shell because they are genuinely separate areas — a
 * workbench and a bill drawer — not one screen seen from two sides.
 */
export const paymentsRoutes: Routes = [
  {
    path: '',
    canActivate: [coachGuard],
    loadComponent: () => import('./coach/coach-payments').then((m) => m.CoachPayments),
    title: 'Payments - MotionHive',
  },
  {
    // Before `:id`, or the parameterised route swallows "new".
    path: 'new',
    canActivate: [coachGuard],
    loadComponent: () =>
      import('./coach/create-invoice/create-invoice').then((m) => m.CreateInvoice),
    title: 'New invoice - MotionHive',
  },
  {
    path: ':id',
    canActivate: [coachGuard],
    loadComponent: () =>
      import('./coach/invoice-detail/coach-invoice-detail').then(
        (m) => m.CoachInvoiceDetail,
      ),
    title: 'Invoice - MotionHive',
  },
];

/** The client side. Any authenticated user can be billed. */
export const billingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./client/client-payments').then((m) => m.ClientPayments),
    title: 'Billing - MotionHive',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./client/invoice-detail/client-invoice-detail').then(
        (m) => m.ClientInvoiceDetail,
      ),
    title: 'Invoice - MotionHive',
  },
];
