import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { SidenavLayoutComponent } from '../../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'bee-organizer',
  imports: [RouterOutlet, SidenavLayoutComponent],
  templateUrl: './instructor.html',
  styleUrl: './instructor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Instructor {
  readonly menuItems: ReadonlyArray<MenuItem> = [
    { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/dashboard' },
    { label: 'Clients', icon: 'pi pi-users', routerLink: '/clients' },
    { label: 'Groups', icon: 'pi pi-sitemap', routerLink: '/groups' },
    { label: 'Profile', icon: 'pi pi-user', routerLink: '/profile' },
    // {
    //   label: 'Dashboard client',
    //   icon: 'pi pi-objects-column',
    //   routerLink: '/client/dashboard',
    // },
  ];
}
