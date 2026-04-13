import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';
import { AuthService } from '../services/auth/auth.service';
import { UserRole } from '../models/user/role.enums';

function redirectByRole(authStore: AuthStore, router: Router): UrlTree {
  if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return router.createUrlTree(['/app/home']);
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

/** Guard factory — allows access when the user has **any** of the given roles. */
export const rolesGuard =
  (...roles: UserRole[]): CanActivateFn =>
  () => {
    inject(AuthService);
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (roles.some((role) => authStore.hasRole(role))) return true;
    if (!authStore.isAuthenticated()) return router.createUrlTree(['/auth/login']);
    return redirectByRole(authStore, router);
  };
