import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SidenavLayoutComponent } from '../../layouts/sidenav-layout/sidenav-layout.component';
import { BecomeInstructor } from './dialogs/become-instructor/become-instructor';

@Component({
  selector: 'bee-client',
  imports: [RouterOutlet, SidenavLayoutComponent, ButtonModule, BecomeInstructor],
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

  becomeInstructorDialogVisible = signal(false);
}
