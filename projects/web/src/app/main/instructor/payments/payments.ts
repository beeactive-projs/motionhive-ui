import { NgTemplateOutlet } from '@angular/common';
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
  CurrencyRonPipe,
  EarningsService,
  StripeOnboardingService,
  type EarningsSummary,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
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
export class Payments implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _earningsService = inject(EarningsService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);

  readonly Tabs = PaymentTabs;

  readonly summary = signal<EarningsSummary | null>(null);
  readonly summaryLoading = signal(true);
  readonly dashboardLoading = signal(false);
  readonly onboardingLoading = signal(true);
  readonly stripeOnboarded = signal(false);
  readonly showCreateDialog = signal(false);

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<PaymentTab>(() => {
    const tab = this._queryParams().get('tab');
    return tab && VALID_TABS.has(tab) ? (tab as PaymentTab) : PaymentTabs.Invoices;
  });

  ngOnInit(): void {
    this.loadOnboardingStatus();
    this.loadSummary();
  }

  private loadOnboardingStatus(): void {
    this._onboardingService.getStatus().subscribe({
      next: (res) => {
        this.stripeOnboarded.set(!!res.account?.chargesEnabled);
        this.onboardingLoading.set(false);
      },
      error: () => {
        this.stripeOnboarded.set(false);
        this.onboardingLoading.set(false);
      },
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this._earningsService.getSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
      },
    });
  }

  openStripeOnboarding(): void {
    this.dashboardLoading.set(true);
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

  openCreateInvoice(): void {
    this.showCreateDialog.set(true);
  }

  onInvoiceCreated(): void {
    // Refresh KPI cards + the active tab content (Invoices listens via its
    // own ngOnInit; forcing a re-load keeps the table in sync if the user
    // is already on the Invoices tab).
    this.loadSummary();
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
