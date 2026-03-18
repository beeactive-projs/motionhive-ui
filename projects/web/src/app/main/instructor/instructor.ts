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
    { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: '/app/dashboard' },
    { label: 'Clients', icon: 'pi pi-users', routerLink: '/app/clients' },
    { label: 'Groups', icon: 'pi pi-sitemap', routerLink: '/app/groups' },
    { label: 'Profile', icon: 'pi pi-user', routerLink: '/app/profile' },
    // {
    //   label: 'Dashboard client',
    //   icon: 'pi pi-objects-column',
    //   routerLink: '/app/client/dashboard',
    // },
  ];
}
