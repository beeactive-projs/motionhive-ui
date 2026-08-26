import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  ClientPaymentService,
  CurrencyRonPipe,
  Invoice,
  InvoiceLineItemDetail,
  InvoiceStatuses,
  displayName,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { PAYMENT_ICONS, isOverdue } from '../../payments.config';

/** How long to keep asking the API whether the payment landed. */
const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 2000;

/**
 * One bill, from the client's side (4h–4k) — and the only screen in the app
 * where money moves.
 *
 * Paying leaves for a Stripe-hosted page, because there is no card form here
 * and there will not be one. That handoff is the risk: a client who cannot
 * tell whether their money moved will message their coach. So the button says
 * where it is sending them, and coming back is treated as a first-class state
 * rather than a page refresh.
 *
 * On return the screen polls quietly under the invoice instead of taking over
 * with a spinner — the invoice stays readable throughout, and the words only
 * become absolute once the API says PAID.
 */
@Component({
  selector: 'mh-client-invoice-detail',
  imports: [
    CurrencyRonPipe,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './client-invoice-detail.html',
  styleUrl: './client-invoice-detail.scss',
})
export class ClientInvoiceDetail {
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _service = inject(ClientPaymentService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly invoiceId = signal<string | null>(null);
  readonly invoice = signal<Invoice | null>(null);
  readonly items = signal<InvoiceLineItemDetail[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly paying = signal(false);

  /** 4i — quietly re-checking after they come back from Stripe. */
  readonly checking = signal(false);
  /** 4j / 4k — what the check concluded. */
  readonly outcome = signal<'paid' | 'unfinished' | null>(null);

  private _sentToStripe = false;
  private _pollsLeft = 0;
  private _pollTimer?: ReturnType<typeof setTimeout>;

  readonly coachName = computed(() =>
    displayName(this.invoice()?.instructor ?? null, 'Your coach'),
  );

  readonly coachTone = computed(() =>
    avatarToneFor(this.invoice()?.instructor?.id ?? undefined),
  );

  readonly isPaid = computed(() => this.invoice()?.status === InvoiceStatuses.Paid);

  readonly overdue = computed(() => {
    const invoice = this.invoice();
    return !!invoice && isOverdue(invoice.status, invoice.dueDate);
  });

  readonly dueLabel = computed(() => {
    const invoice = this.invoice();
    const iso = this.isPaid() ? invoice?.paidAt : invoice?.dueDate;
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  });

  /** The button says where it is going, and in what currency. */
  readonly payLabel = computed(() => {
    const invoice = this.invoice();
    if (!invoice) return 'Pay on Stripe';
    const amount = (invoice.amountDueCents / 100).toFixed(2);
    return `Pay ${amount} ${invoice.currency.toUpperCase()} on Stripe`;
  });

  readonly canPay = computed(
    () => this.invoice()?.status === InvoiceStatuses.Open && !this.paying(),
  );

  constructor() {
    addIcons(PAYMENT_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.invoiceId.set(id);
      if (id) this._load(id);
    });

    // Coming back from the hosted page is the signal that something may have
    // happened. There is no callback into the app, so regaining focus is all
    // there is to go on.
    const onFocus = () => {
      if (this._sentToStripe) this._startReturnCheck();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    this._destroyRef.onDestroy(() => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearTimeout(this._pollTimer);
    });
  }

  pay(): void {
    const id = this.invoiceId();
    if (!id || !this.canPay()) return;
    this.paying.set(true);

    this._service
      .payInvoice(id, {})
      .pipe(take(1))
      .subscribe({
        next: ({ url }) => {
          this.paying.set(false);
          this._sentToStripe = true;
          this.outcome.set(null);
          window.open(url, '_blank', 'noopener');
        },
        error: (error: unknown) => {
          this.paying.set(false);
          void this._feedbackService.error(error, 'Could not open the payment page.');
        },
      });
  }

  openPdf(): void {
    const url = this.invoice()?.invoicePdf;
    if (url) window.open(url, '_blank', 'noopener');
  }

  dismissOutcome(): void {
    this.outcome.set(null);
  }

  retry(): void {
    const id = this.invoiceId();
    if (id) this._load(id);
  }

  private _load(invoiceId: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this._service
      .getMyInvoice(invoiceId)
      .pipe(take(1))
      .subscribe({
        next: (invoice) => {
          this.invoice.set(invoice);
          this.loading.set(false);
          this._loadItems(invoiceId);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  /** Fetched from Stripe on demand; a failure hides the section, per spec. */
  private _loadItems(invoiceId: string): void {
    this._service
      .getMyInvoiceLineItems(invoiceId)
      .pipe(take(1))
      .subscribe({
        next: (items) => this.items.set(items),
        error: () => this.items.set([]),
      });
  }

  /**
   * 4i — poll rather than assume. Stripe confirms by webhook, so "paid" can
   * take a moment to reach us even when the client did everything right.
   * Saying "not completed" too early is the one thing worse than waiting.
   */
  private _startReturnCheck(): void {
    this._sentToStripe = false;
    this._pollsLeft = POLL_ATTEMPTS;
    this.checking.set(true);
    this._poll();
  }

  private _poll(): void {
    const id = this.invoiceId();
    if (!id) return;

    this._service
      .getMyInvoice(id)
      .pipe(take(1))
      .subscribe({
        next: (invoice) => {
          this.invoice.set(invoice);
          if (invoice.status === InvoiceStatuses.Paid) {
            this.checking.set(false);
            this.outcome.set('paid');
            this._loadItems(id);
            return;
          }
          this._pollsLeft -= 1;
          if (this._pollsLeft <= 0) {
            this.checking.set(false);
            this.outcome.set('unfinished');
            return;
          }
          this._pollTimer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
        },
        error: () => {
          this.checking.set(false);
          this.outcome.set('unfinished');
        },
      });
  }
}
