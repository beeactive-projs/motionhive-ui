import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore, NavSection, StripeOnboardingService } from 'core';
import { SidenavLayoutComponent } from '../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'mh-main',
  imports: [RouterOutlet, SidenavLayoutComponent],
  templateUrl: './main.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main {
  private readonly _authStore = inject(AuthStore);
  private readonly _stripeOnboarding = inject(StripeOnboardingService);

  readonly isInstructor = this._authStore.isInstructor;
  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly isWriter = this._authStore.isWriter;
  readonly isUser = this._authStore.isUser;

  readonly navSections = computed<ReadonlyArray<NavSection>>(() => {
    const sections: NavSection[] = [
      {
        label: '',
        items: [
          { label: 'Home', route: '/app/home', icon: 'pi pi-home' },
          { label: 'Explore', route: '/app/explore', icon: 'pi pi-search' },
        ],
      },
    ];

    if (this.isInstructor()) {
      sections.push(
        {
          label: 'My coaching',
          roleRequired: 'INSTRUCTOR',
          items: [
            { label: 'Overview', route: '/app/coaching/overview', icon: 'pi pi-th-large' },
            { label: 'Clients', route: '/app/coaching/clients', icon: 'pi pi-users' },
            { label: 'Sessions', route: '/app/coaching/sessions', icon: 'pi pi-calendar' },
            { label: 'Groups', route: '/app/coaching/groups', icon: 'pi pi-sitemap' },
          ],
        },
        {
          label: 'Revenue',
          roleRequired: 'INSTRUCTOR',
          items: [
            { label: 'Earnings', route: '/app/coaching/earnings', icon: 'pi pi-chart-line' },
            { label: 'Invoices', route: '/app/coaching/invoices', icon: 'pi pi-file' },
            { label: 'Pricing', route: '/app/coaching/pricing', icon: 'pi pi-tag' },
            { label: 'Subscriptions', route: '/app/coaching/subscriptions', icon: 'pi pi-refresh' },
          ],
        },
      );
    }

    sections.push({
      label: 'My activity',
      items: [
        { label: 'Schedule', route: '/app/activity/schedule', icon: 'pi pi-calendar-clock' },
        { label: 'Progress', route: '/app/activity/progress', icon: 'pi pi-chart-bar' },
        { label: 'My invoices', route: '/app/activity/invoices', icon: 'pi pi-receipt' },
        { label: 'My subscriptions', route: '/app/activity/subscriptions', icon: 'pi pi-sync' },
      ],
    });

    if (this.isSuperAdmin() || this.isUser()) {
      sections.push({
        label: 'My space',
        items: [
          { label: 'Dashboard', route: '/app/user/dashboard', icon: 'pi pi-objects-column' },
          { label: 'Instructors', route: '/app/user/instructors', icon: 'pi pi-users' },
        ],
      });
    }

    if (this.isSuperAdmin()) {
      sections.push({
        label: 'Admin',
        items: [
          { label: 'Dashboard', route: '/app/super-admin/dashboard', icon: 'pi pi-objects-column' },
          { label: 'Users', route: '/app/super-admin/users', icon: 'pi pi-users' },
          { label: 'Groups', route: '/app/super-admin/groups', icon: 'pi pi-sitemap' },
        ],
      });
    }

    if (this.isWriter()) {
      sections.push({
        label: 'Writer',
        items: [
          { label: 'Posts', route: '/app/writer/posts', icon: 'pi pi-book' },
        ],
      });
    }

    return sections;
  });

  openStripeDashboard(): void {
    const placeholder = window.open('', '_blank', 'noopener');
    this._stripeOnboarding.getDashboardLink().subscribe({
      next: (res) => {
        if (placeholder) {
          placeholder.location.href = res.url;
        } else {
          window.open(res.url, '_blank', 'noopener');
        }
      },
      error: () => placeholder?.close(),
    });
  }
}
