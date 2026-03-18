// projects/core/src/lib/stores/auth.store.ts
import { computed, Injectable, signal } from '@angular/core';
import { User } from '../models/user/user.model';
import { UserRole, UserRoles } from '../models/user/role.model';

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  // Single source of truth for auth state
  private userSignal = signal<User | null>(null);
  private loadingSignal = signal(false);

  // Public readonly access
  readonly user = this.userSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  // Computed values (automatically update)
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly userRoles = computed(() => this.user()?.roles ?? []);
  readonly isSuperAdmin = computed(() => this.userRoles().includes(UserRoles.SuperAdmin));
  readonly isAdmin = computed(() => this.userRoles().includes(UserRoles.Admin));
  readonly isSupport = computed(() => this.userRoles().includes(UserRoles.Support));
  readonly isInstructor = computed(() => this.userRoles().includes(UserRoles.Instructor));
  readonly isUser = computed(() => this.userRoles().includes(UserRoles.User));
  readonly userName = computed(() => {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  // Actions to update state
  setUser(user: User) {
    this.userSignal.set(user);
  }

  clearUser() {
    this.userSignal.set(null);
  }

  setLoading(loading: boolean) {
    this.loadingSignal.set(loading);
  }

  hasRole(role: UserRole): boolean {
    return this.userRoles().includes(role);
  }

  hasPermission(permission: PermissionName): boolean {
    return this.user()?.permissions.includes(permission) ?? false;
  }
}
