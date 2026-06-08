import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AuthStore,
  LoadingService,
  MessagingStore,
  NavSection,
  StripeOnboardingService,
} from 'core';
import { Loader } from '../_shared/components/loader/loader';
import { SidenavLayoutComponent } from '../layouts/sidenav-layout/sidenav-layout.component';

@Component({
  selector: 'mh-main',
  imports: [RouterOutlet, SidenavLayoutComponent, Loader],
  templateUrl: './main.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main {
  private readonly _authStore = inject(AuthStore);
  private readonly _stripeOnboarding = inject(StripeOnboardingService);
  private readonly _loadingService = inject(LoadingService);
  private readonly _messagingStore = inject(MessagingStore);

  readonly isInstructor = this._authStore.isInstructor;
  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly isWriter = this._authStore.isWriter;
  readonly isUser = this._authStore.isUser;

  protected readonly requestLoading = this._loadingService.requestLoading;

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

  // Navigation model A — "grouped by intent" (Claude Design redesign,
  // motionhive-redesign/MotionHive Redesign.html). A shared top block for
  // everyone, a "My training" group for the consumer self, and a "Coaching"
  // group only for instructors. Account/Billing/Notifications/Safety moved
  // out of the rail into the avatar menu (see ProfileMenu).
  readonly navSections = computed<ReadonlyArray<NavSection>>(() => {
    const sections: NavSection[] = [
      {
        label: '',
        items: [
          { label: 'Home', route: '/home', icon: 'pi pi-home' },
          // Unified discovery hub — coaches, sessions, groups in one place.
          // Replaces the Explore stub and the old duplicate Fitness ▸ Discover.
          { label: 'Discover', route: '/discover', icon: 'pi pi-compass' },
          // Live unread badge wired straight to the store's signal — the
          // sidenav re-renders the pill without us touching the section array.
          {
            label: 'Messages',
            route: '/messages',
            icon: 'pi pi-comment',
            badge: this._messagingStore.unreadTotal,
          },
          { label: 'Groups', route: '/groups', icon: 'pi pi-users' },
        ],
      },
      {
        label: 'My training',
        items: [
          { label: 'My sessions', route: '/user/sessions', icon: 'pi pi-calendar-clock' },
          { label: 'My plans', route: '/my/plans', icon: 'pi pi-bookmark' },
          // Workout history + progress folded into one "Workouts" destination.
          { label: 'Workouts', route: '/my/workouts', icon: 'pi pi-history' },
        ],
      },
    ];

    if (this.isInstructor()) {
      sections.push({
        label: 'Coaching',
        items: [
          // Overview pulled from the rail — the current dashboard is mostly
          // placeholder/mock data. Route + component kept so it can come back
          // as a real coaching dashboard once it has live data to show.
          { label: 'Clients', route: '/coaching/clients', icon: 'pi pi-id-card' },
          { label: 'Sessions', route: '/coaching/sessions', icon: 'pi pi-calendar' },
          { label: 'Programs', route: '/coaching/programs', icon: 'pi pi-objects-column' },
          { label: 'Exercises', route: '/coaching/exercises', icon: 'pi pi-bolt' },
          // Payments lives in Coaching now (the one-item "Revenue" group is gone).
          { label: 'Payments', route: '/coaching/payments', icon: 'pi pi-credit-card' },
        ],
      });
    }

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
