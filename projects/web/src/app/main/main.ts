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
          { label: 'Home', route: '/home', icon: 'pi pi-home' },
          { label: 'Explore', route: '/explore', icon: 'pi pi-search' },
        ],
      },
    ];

    if (this.isInstructor()) {
      sections.push(
        {
          label: 'My coaching',
          items: [
            { label: 'Overview', route: '/coaching/overview', icon: 'pi pi-th-large' },
            { label: 'Clients', route: '/coaching/clients', icon: 'pi pi-users' },
            { label: 'Sessions', route: '/coaching/sessions', icon: 'pi pi-calendar' },
            { label: 'Groups', route: '/coaching/groups', icon: 'pi pi-sitemap' },
          ],
        },
        {
          label: 'Revenue',
          items: [
            { label: 'Earnings', route: '/coaching/earnings', icon: 'pi pi-chart-line' },
            { label: 'Invoices', route: '/coaching/invoices', icon: 'pi pi-file' },
            { label: 'Pricing', route: '/coaching/pricing', icon: 'pi pi-tag' },
            { label: 'Subscriptions', route: '/coaching/subscriptions', icon: 'pi pi-refresh' },
          ],
        },
      );
    }

    sections.push({
      label: 'My activity',
      items: [
        { label: 'Schedule', route: '/activity/schedule', icon: 'pi pi-calendar-clock' },
        { label: 'Progress', route: '/activity/progress', icon: 'pi pi-chart-bar' },
        { label: 'My invoices', route: '/activity/invoices', icon: 'pi pi-receipt' },
        { label: 'My subscriptions', route: '/activity/subscriptions', icon: 'pi pi-sync' },
      ],
    });

    sections.push({
      label: 'My space',
      items: [
        { label: 'Dashboard', route: '/user/dashboard', icon: 'pi pi-objects-column' },
        { label: 'Instructors', route: '/user/instructors', icon: 'pi pi-users' },
      ],
    });

    if (this.isSuperAdmin()) {
      sections.push({
        label: 'Admin',
        items: [
          { label: 'Dashboard', route: '/super-admin/dashboard', icon: 'pi pi-objects-column' },
          { label: 'Users', route: '/super-admin/users', icon: 'pi pi-users' },
          { label: 'Groups', route: '/super-admin/groups', icon: 'pi pi-sitemap' },
        ],
      });
    }

    if (this.isWriter()) {
      sections.push({
        label: 'Writer',
        items: [{ label: 'Posts', route: '/writer/posts', icon: 'pi pi-book' }],
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
