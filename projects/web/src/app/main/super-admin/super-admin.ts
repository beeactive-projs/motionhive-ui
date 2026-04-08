import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterOutlet } from '@angular/router';
import { SidenavLayoutComponent } from '../../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'mh-super-admin',
  imports: [RouterOutlet, SidenavLayoutComponent],
  templateUrl: './super-admin.html',
  styleUrl: './super-admin.scss',
})
export class SuperAdmin {
  readonly menuItems: ReadonlyArray<MenuItem> = [
    { label: 'Dashboard', icon: 'pi pi-objects-column', routerLink: 'dashboard' },
    { label: 'Users', icon: 'pi pi-users', routerLink: 'users' },
    { label: 'Groups', icon: 'pi pi-sitemap', routerLink: 'groups' },
    // {
    //   label: 'Dashboard client',
    //   icon: 'pi pi-objects-column',
    //   routerLink: '/client/dashboard',
    // },
  ];
}
