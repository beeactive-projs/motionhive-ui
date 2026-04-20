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

  // readonly navSections = computed<ReadonlyArray<NavSection>>(() => {
  //   const sections: NavSection[] = [];

  //   // 1. DASHBOARD & DISCOVERY (Core navigation)
  //   sections.push({
  //     label: '',
  //     items: [
  //       { label: 'Home', route: '/home', icon: 'pi pi-home' },
  //       { label: 'Explore', route: '/explore', icon: 'pi pi-compass' },
  //     ],
  //   });

  //   // 2. COACHING (The "Work" section - Visible only if Instructor)
  //   if (this.isInstructor()) {
  //     sections.push({
  //       label: 'Coach Workspace',
  //       items: [
  //         { label: 'Clients', route: '/coaching/clients', icon: 'pi pi-users' },
  //         { label: 'Sessions', route: '/coaching/sessions', icon: 'pi pi-calendar' },
  //         { label: 'Groups', route: '/coaching/groups', icon: 'pi pi-sitemap' },
  //         { label: 'Earnings', route: '/coaching/earnings', icon: 'pi pi-chart-line' },
  //       ],
  //     });
  //   }

  //   // 3. PERSONAL FITNESS (The "Consumer" section)
  //   sections.push({
  //     label: 'My Activity',
  //     items: [
  //       { label: 'Schedule', route: '/activity/schedule', icon: 'pi pi-calendar-clock' },
  //       { label: 'Instructors', route: '/user/instructors', icon: 'pi pi-star' },
  //     ],
  //   });

  //   // 4. MANAGEMENT (Merged Finance & Settings)
  //   // Hide specific invoice/subscription links here and point to a master page
  //   sections.push({
  //     label: 'Management',
  //     items: [
  //       { label: 'Billing & Account', route: '/billing', icon: 'pi pi-wallet' },
  //       ...(this.isSuperAdmin()
  //         ? [{ label: 'Admin Portal', route: '/super-admin/dashboard', icon: 'pi pi-shield' }]
  //         : []),
  //       ...(this.isWriter()
  //         ? [{ label: 'Content Lab', route: '/writer/posts', icon: 'pi pi-pencil' }]
  //         : []),
  //     ],
  //   });

  //   return sections;
  // });

  readonly navSections = computed<ReadonlyArray<NavSection>>(() => {
    const sections: NavSection[] = [
      {
        label: '',
        items: [
          { label: 'Home', route: '/home', icon: 'pi pi-home' },
          { label: 'Explore', route: '/explore', icon: 'pi pi-compass' },
        ],
      },
    ];

    if (this.isInstructor()) {
      sections.push(
        {
          label: 'Coaching',
          items: [
            { label: 'Overview', route: '/coaching/overview', icon: 'pi pi-gauge' },
            { label: 'Clients', route: '/coaching/clients', icon: 'pi pi-users' },
            { label: 'Sessions', route: '/coaching/sessions', icon: 'pi pi-calendar' },
            { label: 'Groups', route: '/coaching/groups', icon: 'pi pi-sitemap' },
          ],
        },
        {
          label: 'Revenue',
          items: [
            { label: 'Payments', route: '/coaching/payments', icon: 'pi pi-credit-card' },
          ],
        },
      );
    }

    sections.push(
      {
        label: 'Fitness',
        items: [
          { label: 'Overview', route: '/user/dashboard', icon: 'pi pi-objects-column' },
          { label: 'Schedule', route: '/activity/schedule', icon: 'pi pi-calendar-clock' },
          { label: 'Progress', route: '/activity/progress', icon: 'pi pi-chart-bar' },
          { label: 'Instructors', route: '/user/instructors', icon: 'pi pi-star' },
        ],
      },
      {
        label: 'Billing',
        items: [
          { label: 'Invoices', route: '/activity/invoices', icon: 'pi pi-receipt' },
          { label: 'Subscriptions', route: '/activity/subscriptions', icon: 'pi pi-sync' },
        ],
      },
    );

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
        label: 'Content',
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
