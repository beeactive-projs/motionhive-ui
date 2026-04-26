import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CurrencyRonPipe,
  EarningsService,
  StripeOnboardingService,
  StripeOnboardingStore,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { catchError, of, startWith, Subject, switchMap } from 'rxjs';
import { CreateInvoiceDialog } from '../_dialogs/create-invoice-dialog/create-invoice-dialog';
import { Invoices } from './invoices/invoices';
import { Products } from './products/products';
import { Subscriptions } from './subscriptions/subscriptions';

export const PaymentTabs = {
  Invoices: 'invoices',
  Memberships: 'memberships',
  Pricing: 'pricing',
} as const;

export type PaymentTab = (typeof PaymentTabs)[keyof typeof PaymentTabs];

const VALID_TABS = new Set<string>(Object.values(PaymentTabs));

@Component({
  selector: 'mh-payments',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Button,
    Card,
    SkeletonModule,
    ToastModule,
    Tooltip,
    CurrencyRonPipe,
    Invoices,
    Subscriptions,
    Products,
    CreateInvoiceDialog,
    NgTemplateOutlet,
  ],
  providers: [MessageService],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payments {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _earningsService = inject(EarningsService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _onboardingStore = inject(StripeOnboardingStore);
  private readonly _messageService = inject(MessageService);

  private readonly _reloadSummary$ = new Subject<void>();

  readonly Tabs = PaymentTabs;
  readonly dashboardLoading = signal(false);
  readonly showCreateDialog = signal(false);

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<PaymentTab>(() => {
    const tab = this._queryParams().get('tab');
    return tab && VALID_TABS.has(tab) ? (tab as PaymentTab) : PaymentTabs.Invoices;
  });

  // Status comes from the shared store — single fetch across the
  // whole app, refreshed only on demand. ensureLoaded() warms the
  // cache the first time the page is visited.
  readonly onboardingStatusLoading = computed(
    () => this._onboardingStore.status() === undefined,
  );
  readonly stripeOnboarded = this._onboardingStore.canIssueInvoices;
  readonly hasStripeAccount = this._onboardingStore.hasAccount;
  readonly needsOnboardingFinish = this._onboardingStore.needsOnboardingFinish;

  readonly summary = toSignal(
    this._reloadSummary$.pipe(
      startWith(undefined),
      switchMap(() => this._earningsService.getSummary().pipe(catchError(() => of(null)))),
    ),
    { initialValue: null },
  );

  readonly pageLoaded = computed(
    () => this._onboardingStore.status() !== undefined,
  );

  constructor() {
    this._onboardingStore.ensureLoaded();
  }

  /**
   * Force a live pull from Stripe via the shared store. Useful after
   * the user returned from hosted onboarding when the webhook hasn't
   * arrived yet (localhost dev especially). Every consumer reading
   * the store's signals re-renders automatically.
   */
  refreshStatus(): void {
    this._onboardingStore.refresh();
  }

  openStripeOnboarding(): void {
    this.dashboardLoading.set(true);
    // Route to Stripe-hosted onboarding when either:
    //   - no account exists yet (create one), OR
    //   - account exists but form isn't submitted (resume). Stripe's
    //     Account Links API is idempotent per-account so resuming
    //     continues the same KYC flow — no new account is created.
    if (!this.hasStripeAccount() || this.needsOnboardingFinish()) {
      const origin = window.location.origin;
      this._onboardingService
        .start({
          returnUrl: `${origin}/coaching/onboarding/return`,
          refreshUrl: `${origin}/coaching/onboarding/refresh`,
        })
        .subscribe({
          next: (res) => {
            window.location.href = res.url;
          },
          error: (err) => {
            this.dashboardLoading.set(false);
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to start onboarding',
            });
          },
        });
      return;
    }

    this._onboardingService.getDashboardLink().subscribe({
      next: (res) => {
        this.dashboardLoading.set(false);
        window.open(res.url, '_blank');
      },
      error: (err) => {
        this.dashboardLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to open Stripe Dashboard',
        });
      },
    });
  }

  onInvoiceCreated(): void {
    this._reloadSummary$.next();
  }

  onTabChange(value: string | number | undefined): void {
    const tab = typeof value === 'string' && VALID_TABS.has(value) ? value : PaymentTabs.Invoices;
    if (tab === this.activeTab()) return;
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
