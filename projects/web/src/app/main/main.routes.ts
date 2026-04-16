import { Routes } from '@angular/router';
import {
  rolesGuard,
  instructorGuard,
  participantGuard,
  roleRedirectGuard,
  superAdminGuard,
  UserRoles,
} from 'core';

export const mainRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./main').then((m) => m.Main),
    children: [
      // Shared — accessible to all authenticated users
      { path: 'home', loadComponent: () => import('./home/home').then((m) => m.Home), title: 'Home - MotionHive' },
      { path: 'explore', loadComponent: () => import('./explore/explore').then((m) => m.Explore), title: 'Explore - MotionHive' },
      {
        path: 'join/:token',
        loadComponent: () => import('./join-group/join-group').then((m) => m.JoinGroup),
        title: 'Join Group - MotionHive',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile),
        title: 'My Profile - MotionHive',
      },

      // Instructor — Coaching
      {
        path: 'coaching/overview',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/coaching-overview/coaching-overview').then((m) => m.CoachingOverview),
        title: 'Coaching Overview - MotionHive',
      },
      {
        path: 'coaching/clients',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/clients/clients').then((m) => m.Clients),
        title: 'Clients - MotionHive',
      },
      {
        path: 'coaching/sessions',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/sessions/sessions').then((m) => m.Sessions),
        title: 'Sessions - MotionHive',
      },
      {
        path: 'coaching/groups',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/groups/groups').then((m) => m.Groups),
        title: 'Groups - MotionHive',
      },
      {
        path: 'coaching/groups/:id',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/groups/group-detail/group-detail').then((m) => m.GroupDetail),
        title: 'Group Details - MotionHive',
      },

      // Instructor — Revenue
      {
        path: 'coaching/earnings',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/earnings/earnings').then((m) => m.Earnings),
        title: 'Earnings - MotionHive',
      },
      {
        path: 'coaching/invoices',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/invoices/invoices').then((m) => m.Invoices),
        title: 'Invoices - MotionHive',
      },
      {
        path: 'coaching/invoices/:id',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/invoices/invoice-detail/invoice-detail').then(
            (m) => m.InvoiceDetail,
          ),
        title: 'Invoice Details - MotionHive',
      },
      {
        path: 'coaching/pricing',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/products/products').then((m) => m.Products),
        title: 'Pricing - MotionHive',
      },
      {
        path: 'coaching/subscriptions',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/subscriptions/subscriptions').then(
            (m) => m.Subscriptions,
          ),
        title: 'Subscriptions - MotionHive',
      },
      {
        path: 'coaching/onboarding/return',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/onboarding-return/onboarding-return').then(
            (m) => m.OnboardingReturn,
          ),
        title: 'Onboarding - MotionHive',
      },
      {
        path: 'coaching/onboarding/refresh',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/payments/onboarding-refresh/onboarding-refresh').then(
            (m) => m.OnboardingRefresh,
          ),
        title: 'Onboarding - MotionHive',
      },

      // Activity (any authenticated user)
      {
        path: 'activity/schedule',
        loadComponent: () => import('./user/schedule/schedule').then((m) => m.Schedule),
        title: 'My Schedule - MotionHive',
      },
      {
        path: 'activity/progress',
        loadComponent: () => import('./user/progress/progress').then((m) => m.Progress),
        title: 'My Progress - MotionHive',
      },
      {
        path: 'activity/invoices',
        loadComponent: () =>
          import('./user/payments/my-invoices/my-invoices').then((m) => m.MyInvoices),
        title: 'My Invoices - MotionHive',
      },
      {
        path: 'activity/invoices/:id',
        loadComponent: () =>
          import('./user/payments/invoice-detail/invoice-detail').then(
            (m) => m.UserInvoiceDetail,
          ),
        title: 'Invoice - MotionHive',
      },
      {
        path: 'activity/subscriptions',
        loadComponent: () =>
          import('./user/payments/my-subscriptions/my-subscriptions').then(
            (m) => m.MySubscriptions,
          ),
        title: 'My Subscriptions - MotionHive',
      },
      {
        path: 'activity/checkout/return',
        loadComponent: () =>
          import('./user/payments/checkout-return/checkout-return').then(
            (m) => m.CheckoutReturn,
          ),
        title: 'Payment - MotionHive',
      },
      {
        path: 'user/dashboard',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.User)],
        loadComponent: () => import('./user/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'user/instructors',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.User)],
        loadComponent: () => import('./user/instructors/instructors').then((m) => m.Instructors),
        title: 'My Instructors - MotionHive',
      },

      // Writer section
      {
        path: 'writer/posts',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () => import('./writer/posts/posts').then((m) => m.Posts),
        title: 'Posts - MotionHive',
      },
      {
        path: 'writer/posts/new',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'New Post - MotionHive',
      },
      {
        path: 'writer/posts/:id',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'Edit Post - MotionHive',
      },

      // Super-admin section
      {
        path: 'super-admin/dashboard',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'super-admin/users',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/users/users').then((m) => m.Users),
        title: 'Users - MotionHive',
      },
      {
        path: 'super-admin/groups',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/groups/groups').then((m) => m.Groups),
        title: 'Groups - MotionHive',
      },

      // Role-aware default redirect
      {
        path: '',
        pathMatch: 'full',
        canActivate: [roleRedirectGuard],
        children: [],
      },
    ],
  },
];
