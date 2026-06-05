import { Component, ChangeDetectionStrategy, computed, inject, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { AuthStore, AuthService, BillingCountsStore, FeedbackService } from 'core';
import { Avatar } from '../avatar/avatar';

interface AccountMenuItem {
  label: string;
  icon: string;
  routerLink: string[];
  queryParams?: Record<string, string>;
  hint?: string;
}

interface AccountMenuGroup {
  label: string;
  items: AccountMenuItem[];
}

@Component({
  selector: 'mh-profile-menu',
  imports: [RouterLink, Avatar, ButtonModule, PopoverModule, DividerModule],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenu {
  private readonly _authStore = inject(AuthStore);
  private readonly _authService = inject(AuthService);
  private readonly _billingCounts = inject(BillingCountsStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  constructor() {
    // The account menu lives in the persistent layout, so this fires
    // exactly once per session — the cached counts then feed both the
    // menu's Billing item and the profile Billing tab. No per-render hits.
    this._billingCounts.ensureLoaded();
  }

  /**
   * Account menu — the home for everything pulled out of the left rail in
   * the IA redesign (Model A): public profile, account, billing,
   * notifications, safety. Grouped with optional section labels.
   */
  readonly accountGroups = computed(() => {
    const handle = this._authStore.user()?.handle;
    const groups: AccountMenuGroup[] = [];

    // Public storefront — only meaningful once a handle is claimed.
    if (handle) {
      groups.push({
        label: '',
        items: [
          {
            label: 'View public profile',
            icon: 'pi pi-compass',
            routerLink: ['/@' + handle],
            hint: 'your storefront',
          },
        ],
      });
    }

    // Settings — each item lands on a real, always-present profile tab.
    // 'Account & profile' covers personal info + (for coaches) bio,
    // specialties, certifications and venues.
    const settings: AccountMenuItem[] = [
      {
        label: 'Account & profile',
        icon: 'pi pi-user',
        routerLink: ['/profile'],
        queryParams: { tab: 'details' },
      },
    ];

    // Billing only appears once the user actually has an invoice or
    // membership — driven by the cached counts, no extra request.
    if (this._billingCounts.hasBilling()) {
      settings.push({
        label: 'Billing & payments',
        icon: 'pi pi-credit-card',
        routerLink: ['/profile'],
        queryParams: { tab: 'billing' },
      });
    }

    settings.push(
      {
        label: 'Notifications',
        icon: 'pi pi-bell',
        routerLink: ['/profile'],
        queryParams: { tab: 'notifications' },
      },
      {
        label: 'Safety & privacy',
        icon: 'pi pi-shield',
        routerLink: ['/profile'],
        queryParams: { tab: 'safety' },
      },
    );

    groups.push({ label: 'Settings', items: settings });
    return groups;
  });

  private readonly _popover = viewChild.required<Popover>('popover');

  readonly user = this._authStore.user;
  readonly userName = this._authStore.userName;
  readonly isInstructor = this._authStore.isInstructor;

  readonly initials = computed(() => {
    const u = this._authStore.user();
    if (!u) return '';
    return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
  });

  toggle(event: Event): void {
    this._popover().toggle(event);
  }

  closeMenu(): void {
    this._popover().hide();
  }

  openFeedback(): void {
    this._popover().hide();
    this._feedbackService.open();
  }

  signOut(): void {
    this.closeMenu();
    this._authService.logout().subscribe(() => {
      this._router.navigate(['/auth/login']);
    });
  }
}
