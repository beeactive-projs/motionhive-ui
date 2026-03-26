import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { SidenavLayoutComponent } from '../../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'bee-client',
  imports: [RouterOutlet, SidenavLayoutComponent],
  templateUrl: './client.html',
  styleUrl: './client.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Client {
  readonly menuItems: ReadonlyArray<MenuItem> = [
    { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/app/client/dashboard' },
    { label: 'My Instructors', icon: 'pi pi-users', routerLink: '/app/client/instructors' },
    { label: 'Groups', icon: 'pi pi pi-sitemap', routerLink: '/app/client/groups' },
    { label: 'Profile', icon: 'pi pi-user', routerLink: '/app/client/profile' },
  ];
}
