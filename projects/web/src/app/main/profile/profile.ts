import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClientPaymentService,
  MyBillingCounts,
  MyProfile,
  ProfileService,
} from 'core';
import { MessageService } from 'primeng/api';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { Button } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { Details } from './tabs/details/details';
import { MyInvoices } from '../user/payments/my-invoices/my-invoices';
import { MySubscriptions } from '../user/payments/my-subscriptions/my-subscriptions';

export const ProfileTabs = {
  Details: 'details',
  Invoices: 'invoices',
  Memberships: 'memberships',
} as const;

export type ProfileTab = (typeof ProfileTabs)[keyof typeof ProfileTabs];

const VALID_TABS = new Set<string>(Object.values(ProfileTabs));

@Component({
  selector: 'mh-profile',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    SkeletonModule,
    CardModule,
    Button,
    ToastModule,
    Details,
    MyInvoices,
    MySubscriptions,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly Tabs = ProfileTabs;

  readonly profile = signal<MyProfile | null>(null);
  readonly loading = signal(true);
  readonly counts = signal<MyBillingCounts | null>(null);

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<ProfileTab>(() => {
    const tab = this._queryParams().get('tab');
    return tab && VALID_TABS.has(tab) ? (tab as ProfileTab) : ProfileTabs.Details;
  });

  readonly showInvoicesTab = computed(() => (this.counts()?.invoices.total ?? 0) > 0);
  readonly showMembershipsTab = computed(
    () => (this.counts()?.memberships.total ?? 0) > 0,
  );

  readonly invoicesBadge = computed(() => this.counts()?.invoices.open ?? 0);
  readonly membershipsBadge = computed(
    () => this.counts()?.memberships.active ?? 0,
  );

  ngOnInit(): void {
    this.loadProfile();
    this.loadCounts();
  }

  loadProfile(): void {
    this.loading.set(true);
    this._profileService.getMyProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load profile data',
        });
      },
    });
  }

  private loadCounts(): void {
    this._clientPaymentService.getMyCounts().subscribe({
      next: (counts) => this.counts.set(counts),
      error: () => {
        // Counts are non-critical; tabs fall back to Details-only.
        this.counts.set(null);
      },
    });
  }

  onTabChange(value: string | number | undefined): void {
    const tab =
      typeof value === 'string' && VALID_TABS.has(value)
        ? value
        : ProfileTabs.Details;
    if (tab === this.activeTab()) return;
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
