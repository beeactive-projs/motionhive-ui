import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { AuthStore } from 'core';
import { SidenavLayoutComponent } from '../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'mh-main',
  imports: [RouterOutlet, SidenavLayoutComponent],
  templateUrl: './main.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main {
  private readonly _authStore = inject(AuthStore);

  readonly menuItems = computed<ReadonlyArray<MenuItem>>(() => {
    const isSuperAdmin = this._authStore.isSuperAdmin();
    const isInstructor = this._authStore.isInstructor();
    const isUser = this._authStore.isUser();
    const multiRole = [isSuperAdmin, isInstructor, isUser].filter(Boolean).length > 1;

    const items: MenuItem[] = [];

    if (isSuperAdmin) {
      if (multiRole) items.push({ label: 'Admin', separator: true });
      items.push(
        { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/super-admin/dashboard' },
        { label: 'Users', icon: 'pi pi-users', routerLink: '/super-admin/users' },
        { label: 'Groups', icon: 'pi pi-sitemap', routerLink: '/super-admin/groups' },
      );
    }

    if (isInstructor) {
      if (multiRole) items.push({ label: 'Instructor', separator: true });
      items.push(
        { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/dashboard' },
        { label: 'Clients', icon: 'pi pi-users', routerLink: '/clients' },
        { label: 'Groups', icon: 'pi pi-sitemap', routerLink: '/groups' },
      );
    }

    if (isUser) {
      if (multiRole) items.push({ label: 'User', separator: true });
      items.push(
        { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/user/dashboard' },
        { label: 'Instructors', icon: 'pi pi-users', routerLink: '/user/instructors' },
      );
    }

    items.push({ label: 'Profile', icon: 'pi pi-user', routerLink: '/profile' });

    return items;
  });
}
