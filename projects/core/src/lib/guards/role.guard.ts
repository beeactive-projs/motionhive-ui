import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';
import { AuthService } from '../services/auth/auth.service';

export const roleRedirectGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isInstructor()) return router.createUrlTree(['/dashboard']);
  if (authStore.isUser()) return router.createUrlTree(['/user/dashboard']);
  if (authStore.isSuperAdmin()) return router.createUrlTree(['/super-admin/dashboard']);

  return router.createUrlTree(['/auth/login']);
};

export const superAdminGuard: CanActivateFn = () => {
  // Ensure AuthService is constructed so checkAuthStatus() populates the store
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isSuperAdmin()) {
    return true;
  }

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  if (authStore.isInstructor()) return router.createUrlTree(['/dashboard']);
  return router.createUrlTree(['/user/dashboard']);
};

export const instructorGuard: CanActivateFn = () => {
  // Ensure AuthService is constructed so checkAuthStatus() populates the store
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isInstructor()) {
    return true;
  }

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  if (authStore.isSuperAdmin()) return router.createUrlTree(['/super-admin/dashboard']);
  return router.createUrlTree(['/user/dashboard']);
};

export const participantGuard: CanActivateFn = () => {
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isUser()) {
    return true;
  }

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  if (authStore.isInstructor()) return router.createUrlTree(['/dashboard']);
  if (authStore.isSuperAdmin()) return router.createUrlTree(['/super-admin/dashboard']);
  return router.createUrlTree(['/dashboard']);
};
