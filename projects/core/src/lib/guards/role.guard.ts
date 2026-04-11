import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';
import { AuthService } from '../services/auth/auth.service';

function redirectByRole(authStore: AuthStore, router: Router): UrlTree {
  if (authStore.isSuperAdmin()) return router.createUrlTree(['/super-admin/dashboard']);
  if (authStore.isAdmin()) return router.createUrlTree(['/admin/dashboard']);
  if (authStore.isSupport()) return router.createUrlTree(['/support/dashboard']);
  if (authStore.isWriter()) return router.createUrlTree(['/writer/dashboard']);
  if (authStore.isInstructor()) return router.createUrlTree(['/dashboard']);
  if (authStore.isUser()) return router.createUrlTree(['/user/dashboard']);
  return router.createUrlTree(['/auth/login']);
}

export const roleRedirectGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return redirectByRole(authStore, router);
};

export const superAdminGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isSuperAdmin()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};

export const adminGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAdmin()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};

export const supportGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isSupport()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};

export const writerGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isWriter()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};

export const instructorGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isInstructor()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};

export const participantGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isUser()) return true;
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return redirectByRole(authStore, router);
};
