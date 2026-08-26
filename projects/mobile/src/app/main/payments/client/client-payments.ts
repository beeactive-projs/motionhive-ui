import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonNote,
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
import { take } from 'rxjs';

import {
  ClientPaymentService,
  CurrencyRonPipe,
  Invoice,
  InvoiceStatuses,
  Subscription,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { InvoiceRow } from '../_components/invoice-row/invoice-row';
import { ConfirmSheet } from '../_sheets/confirm-sheet/confirm-sheet';
import { PAYMENT_ICONS } from '../payments.config';

const PAGE_SIZE = 20;

/**
 * The client's bills (4g) — a drawer, not a workbench.
 *
 * They see OPEN and PAID only; drafts and voids are the coach's business and
 * the API does not send them. No filters either: Due sits above Paid, and
 * chronology holds inside each. Two sections is not a list that needs
 * narrowing.
 *
 * Amounts are never summed. A client can be billed by two coaches settling in
 * different currencies, so the due strip carries one chip per currency rather
 * than a single total that would be arithmetic on unlike things.
 */
@Component({
  selector: 'mh-client-payments',
  imports: [
    ConfirmSheet,
    CurrencyRonPipe,
    DatePipe,
    EmptyState,
    InvoiceRow,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './client-payments.html',
  styleUrl: './client-payments.scss',
})
export class ClientPayments implements ViewWillEnter {
  private readonly _service = inject(ClientPaymentService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4];

  readonly segments = [
    { value: 'invoices', label: 'Invoices' },
    { value: 'memberships', label: 'Memberships' },
  ] as const;

  readonly segment = signal<'invoices' | 'memberships'>('invoices');
  readonly invoices = signal<Invoice[]>([]);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly total = signal(0);
  readonly acting = signal(false);

  readonly cancelTarget = signal<Subscription | null>(null);
  readonly cancelOpen = signal(false);

  private readonly _page = signal(1);

  readonly hasMore = computed(() => this.invoices().length < this.total());

  readonly due = computed(() =>
    this.invoices().filter((invoice) => invoice.status === InvoiceStatuses.Open),
  );

  readonly paid = computed(() =>
    this.invoices().filter((invoice) => invoice.status === InvoiceStatuses.Paid),
  );

  /**
   * One chip per currency. Merging them would be arithmetic on unlike things,
   * and a client billed in two currencies is exactly who most needs the
   * number to be right.
   */
  readonly dueTotals = computed(() => {
    const byCurrency = new Map<string, number>();
    for (const invoice of this.due()) {
      const key = invoice.currency.toUpperCase();
      byCurrency.set(key, (byCurrency.get(key) ?? 0) + invoice.amountDueCents);
    }
    return [...byCurrency].map(([currency, cents]) => ({ currency, cents }));
  });

  readonly showSkeleton = computed(() => this.loading() && this.invoices().length === 0);

  readonly showLoadError = computed(
    () => this.loadFailed() && this.invoices().length === 0,
  );

  readonly isEmpty = computed(
    () => !this.loading() && !this.loadFailed() && this.invoices().length === 0,
  );

  readonly cancelFacts = computed(() => {
    const sub = this.cancelTarget();
    if (!sub) return [];
    return [
      { label: 'Plan', value: sub.product?.name ?? 'Membership' },
      {
        label: 'Access until',
        value: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'the end of this period',
      },
    ];
  });

  constructor() {
    addIcons(PAYMENT_ICONS);
  }

  ionViewWillEnter(): void {
    this._load();
    this._loadSubscriptions();
  }

  onSegmentChange(event: SegmentCustomEvent): void {
    const value = event.detail.value;
    if (typeof value === 'string') this.segment.set(value as 'invoices' | 'memberships');
  }

  open(invoice: Invoice): void {
    void this._router.navigate(['/tabs/home/billing', invoice.id]);
  }

  /** Saved cards live in Stripe's hosted portal — there is no card UI here. */
  openPortal(): void {
    this._service
      .getPortalLink()
      .pipe(take(1))
      .subscribe({
        next: ({ url }) => window.open(url, '_blank', 'noopener'),
        error: (error: unknown) =>
          void this._feedbackService.error(error, 'Could not open your payment settings.'),
      });
  }

  askCancel(subscription: Subscription): void {
    this.cancelTarget.set(subscription);
    this.cancelOpen.set(true);
  }

  confirmCancel(): void {
    const sub = this.cancelTarget();
    if (!sub || this.acting()) return;
    this.acting.set(true);

    this._service
      .cancelMySubscription(sub.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.cancelOpen.set(false);
          void this._feedbackService.success('Membership will end at the period end');
          this._loadSubscriptions();
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'Could not cancel that membership.');
        },
      });
  }

  retry(): void {
    this._load();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._loadSubscriptions();
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

  private _load(opts: { append?: boolean; done?: () => void } = {}): void {
    if (!opts.append) this._page.set(1);
    this.loading.set(true);
    this.loadFailed.set(false);

    this._service
      .getMyInvoices({ page: this._page(), limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.invoices.update((current) =>
            opts.append ? [...current, ...response.items] : response.items,
          );
          this.total.set(response.total);
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

  private _loadSubscriptions(): void {
    this._service
      .getMySubscriptions()
      .pipe(take(1))
      .subscribe({ next: (response) => this.subscriptions.set(response.items ?? []) });
  }
}
