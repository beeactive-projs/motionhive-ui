import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';
import { AuthService } from '../services/auth/auth.service';

export const organizerGuard: CanActivateFn = () => {
  // Ensure AuthService is constructed so checkAuthStatus() populates the store
  inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isInstructor()) {
    return true;
  }

  // Only redirect if we know the user's role; if no user loaded, go to login
  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  return router.createUrlTree(['/app/client/dashboard']);
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

  return router.createUrlTree(['/app/dashboard']);
};
