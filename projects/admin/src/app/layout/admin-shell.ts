import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, AuthStore } from 'core';

interface AdminNavItem {
  label: string;
  route: string;
  icon: string;
  superAdminOnly?: boolean;
}

/**
 * Lightweight admin chrome: fixed sidebar + slim topbar. Deliberately
 * standalone (no coupling to the web app's SidenavLayout) to keep the
 * admin bundle small and independent.
 */
@Component({
  selector: 'mh-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  private readonly _authStore = inject(AuthStore);
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly userName = this._authStore.userName;

  private readonly _items: AdminNavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'pi pi-home' },
    { label: 'Users', route: '/users', icon: 'pi pi-users' },
    { label: 'Database', route: '/database', icon: 'pi pi-database', superAdminOnly: true },
  ];

  readonly navItems = computed(() =>
    this._items.filter((i) => !i.superAdminOnly || this.isSuperAdmin()),
  );

  logout(): void {
    this._authService.logout().subscribe({
      next: () => this._router.navigate(['/auth/login']),
      error: () => this._router.navigate(['/auth/login']),
    });
  }
}
