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
    path: 'invoices',
    loadComponent: () => import('./payments/my-invoices/my-invoices').then((m) => m.MyInvoices),
    title: 'My Invoices - MotionHive',
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./payments/invoice-detail/invoice-detail').then((m) => m.UserInvoiceDetail),
    title: 'Invoice - MotionHive',
  },
  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./payments/my-subscriptions/my-subscriptions').then((m) => m.MySubscriptions),
    title: 'My Subscriptions - MotionHive',
  },
  {
    path: 'checkout/return',
    loadComponent: () =>
      import('./payments/checkout-return/checkout-return').then((m) => m.CheckoutReturn),
    title: 'Payment - MotionHive',
  },
];
