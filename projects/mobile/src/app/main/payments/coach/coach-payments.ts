import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
  SegmentCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, take } from 'rxjs';

import {
  CurrencyRonPipe,
  EarningsService,
  EarningsSummary,
  Invoice,
  InvoiceService,
  InvoiceStatus,
  StripeAccountStatuses,
  StripeOnboardingService,
  deriveStripeAccountStatus,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { InvoiceRow } from '../_components/invoice-row/invoice-row';
import { INVOICE_FILTERS, PAYMENT_ICONS, isOverdue } from '../payments.config';

const PAGE_SIZE = 20;

/**
 * The coach's payments hub (4b): what they are owed, what they have been
 * paid, and the way to bill someone.
 *
 * A workbench, not a bill drawer — every status is reachable, overdue is
 * pulled out of time order into its own section, and creating an invoice is
 * one tap away because "invoice them right after the session" is a phone
 * moment.
 *
 * Nothing is summed across currencies. A coach settles in one currency, so
 * the earnings strip is safe to total; the invoice list is not, which is why
 * each row carries its own code and there is no list-level total.
 */
@Component({
  selector: 'mh-coach-payments',
  imports: [
    CurrencyRonPipe,
    EmptyState,
    InvoiceRow,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './coach-payments.html',
  styleUrl: './coach-payments.scss',
})
export class CoachPayments implements ViewWillEnter {
  private readonly _invoiceService = inject(InvoiceService);
  private readonly _earningsService = inject(EarningsService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  readonly filters = INVOICE_FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly segments = [
    { value: 'invoices', label: 'Invoices' },
    { value: 'memberships', label: 'Memberships' },
  ] as const;

  readonly segment = signal<'invoices' | 'memberships'>('invoices');
  readonly status = signal<InvoiceStatus | null>(null);
  readonly invoices = signal<Invoice[]>([]);
  readonly earnings = signal<EarningsSummary | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly total = signal(0);

  /** Null until the onboarding check answers; drives the gate in 4f. */
  readonly connectStatus = signal<string | null>(null);
  readonly connecting = signal(false);

  private readonly _page = signal(1);

  readonly hasMore = computed(() => this.invoices().length < this.total());

  /**
   * Stripe is not connected, or Stripe wants more from them. Either way the
   * hub is replaced by the gate rather than shown as an empty list with a
   * button that cannot work.
   */
  readonly blocked = computed(
    () =>
      this.connectStatus() === StripeAccountStatuses.NotStarted ||
      this.connectStatus() === StripeAccountStatuses.Restricted ||
      this.connectStatus() === StripeAccountStatuses.Disconnected,
  );

  readonly needsMore = computed(
    () => this.connectStatus() === StripeAccountStatuses.Restricted,
  );

  readonly showSkeleton = computed(
    () => this.loading() && this.invoices().length === 0 && !this.blocked(),
  );

  readonly showLoadError = computed(
    () => this.loadFailed() && this.invoices().length === 0,
  );

  readonly isEmpty = computed(
    () => !this.loading() && !this.loadFailed() && this.invoices().length === 0,
  );

  /** Overdue leaves time order and rises to the top — it is the work. */
  readonly overdue = computed(() =>
    this.invoices().filter((invoice) => isOverdue(invoice.status, invoice.dueDate)),
  );

  readonly rest = computed(() =>
    this.invoices().filter((invoice) => !isOverdue(invoice.status, invoice.dueDate)),
  );

  constructor() {
    addIcons(PAYMENT_ICONS);
  }

  // Not ngOnInit: the tab stack keeps this page alive, and an invoice paid
  // elsewhere has to show up on the next visit.
  ionViewWillEnter(): void {
    this._loadStatus();
    this._load();
  }

  onSegmentChange(event: SegmentCustomEvent): void {
    const value = event.detail.value;
    if (typeof value === 'string') this.segment.set(value as 'invoices' | 'memberships');
  }

  setStatus(status: InvoiceStatus | null): void {
    if (this.status() === status) return;
    this.status.set(status);
    this.invoices.set([]);
    this._load();
  }

  open(invoice: Invoice): void {
    void this._router.navigate(['/tabs/home/payments', invoice.id]);
  }

  create(): void {
    void this._router.navigate(['/tabs/home/payments/new']);
  }

  /** Connect onboarding is hosted by Stripe, so it leaves the app. */
  connect(): void {
    if (this.connecting()) return;
    this.connecting.set(true);
    this._onboardingService
      .start({})
      .pipe(take(1))
      .subscribe({
        next: ({ url }) => {
          this.connecting.set(false);
          window.open(url, '_blank', 'noopener');
        },
        error: (error: unknown) => {
          this.connecting.set(false);
          void this._feedbackService.error(error, 'Could not open Stripe onboarding.');
        },
      });
  }

  /** The escape hatch for a webhook we never received. */
  refreshStatus(): void {
    this._onboardingService
      .refreshStatus()
      .pipe(take(1))
      .subscribe({ next: () => this._loadStatus() });
  }

  retry(): void {
    this._load();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._loadStatus();
    this._load({ done: () => void event.target.complete() });
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    if (this.loading() || !this.hasMore()) {
      void event.target.complete();
      return;
    }
    this._page.update((page) => page + 1);
    this._load({ append: true, done: () => void event.target.complete() });
  }

  private _loadStatus(): void {
    this._onboardingService
      .getStatus()
      .pipe(take(1))
      .subscribe({
        next: ({ account }) => this.connectStatus.set(deriveStripeAccountStatus(account)),
      });
  }

  private _load(opts: { append?: boolean; done?: () => void } = {}): void {
    if (!opts.append) this._page.set(1);
    this.loading.set(true);
    this.loadFailed.set(false);

    const status = this.status();
    forkJoin({
      invoices: this._invoiceService.list({
        page: this._page(),
        limit: PAGE_SIZE,
        ...(status ? { status } : {}),
      }),
      // The strip is a single currency by definition — a coach settles in one.
      earnings: this._earningsService.getSummary(),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ invoices, earnings }) => {
          this.invoices.update((current) =>
            opts.append ? [...current, ...invoices.items] : invoices.items,
          );
          this.total.set(invoices.total);
          this.earnings.set(earnings);
          this.loading.set(false);
          opts.done?.();
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          opts.done?.();
        },
      });
  }
}
