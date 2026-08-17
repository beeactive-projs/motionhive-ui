import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Observable, take } from 'rxjs';

import {
  CurrencyRonPipe,
  EarningsService,
  Invoice,
  InvoiceLineItemDetail,
  InvoiceService,
  InvoiceStatuses,
  RefundService,
  displayName,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { ConfirmSheet } from '../../_sheets/confirm-sheet/confirm-sheet';
import {
  PAYMENT_ICONS,
  formatMoney,
  invoiceStatusStyle,
  isOverdue,
  refundDaysLeft,
} from '../../payments.config';

/**
 * One invoice, from the coach's side (4c / 4d).
 *
 * The amount block leads because that is the question. What can be done to it
 * depends entirely on status, and only one state has a primary action: a
 * draft, which nobody has seen yet. An open invoice's next move belongs to the
 * client, so Mark paid and Void are both secondary — there is no honey button
 * for waiting.
 *
 * Reminder emails are deliberately absent. Stripe owns invoice email; a
 * "Send reminder" here would either lie or duplicate.
 */
@Component({
  selector: 'mh-coach-invoice-detail',
  imports: [
    ConfirmSheet,
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
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './coach-invoice-detail.html',
  styleUrl: './coach-invoice-detail.scss',
})
export class CoachInvoiceDetail {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _invoiceService = inject(InvoiceService);
  private readonly _refundService = inject(RefundService);
  private readonly _earningsService = inject(EarningsService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly invoiceId = signal<string | null>(null);
  readonly invoice = signal<Invoice | null>(null);
  readonly items = signal<InvoiceLineItemDetail[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly acting = signal(false);

  readonly sendOpen = signal(false);
  readonly voidOpen = signal(false);
  readonly markPaidOpen = signal(false);
  readonly refundOpen = signal(false);

  readonly Statuses = InvoiceStatuses;

  readonly clientName = computed(() =>
    displayName(this.invoice()?.client ?? null, this.invoice()?.clientEmail ?? 'Client'),
  );

  readonly clientTone = computed(() =>
    avatarToneFor(this.invoice()?.client?.id ?? undefined),
  );

  readonly style = computed(() => {
    const invoice = this.invoice();
    return invoice ? invoiceStatusStyle(invoice.status) : null;
  });

  readonly overdue = computed(() => {
    const invoice = this.invoice();
    return !!invoice && isOverdue(invoice.status, invoice.dueDate);
  });

  readonly isDraft = computed(() => this.invoice()?.status === InvoiceStatuses.Draft);
  readonly isOpen = computed(() => this.invoice()?.status === InvoiceStatuses.Open);
  readonly isPaid = computed(() => this.invoice()?.status === InvoiceStatuses.Paid);

  readonly remainingCents = computed(() => {
    const invoice = this.invoice();
    if (!invoice) return 0;
    return Math.max(0, invoice.amountDueCents - invoice.amountPaidCents);
  });

  /** Whole days left in Stripe's 14-day refund window. */
  readonly refundDays = computed(() => refundDaysLeft(this.invoice()?.paidAt));

  readonly canRefund = computed(() => this.isPaid() && this.refundDays() > 0);

  /** Sheet facts are data, so they format here rather than through the pipe. */
  readonly dueMoney = computed(() => {
    const inv = this.invoice();
    return inv ? formatMoney(inv.amountDueCents, inv.currency) : '';
  });

  readonly paidMoney = computed(() => {
    const inv = this.invoice();
    return inv ? formatMoney(inv.amountPaidCents, inv.currency) : '';
  });

  readonly sendFacts = computed(() => [
    { label: 'To', value: this.clientName() },
    { label: 'Amount', value: this.dueMoney() },
  ]);

  readonly markPaidFacts = computed(() => [
    { label: 'From', value: this.clientName() },
    { label: 'Amount', value: this.dueMoney() },
  ]);

  readonly refundFacts = computed(() => [
    { label: 'Amount', value: this.paidMoney() },
    {
      label: 'Window closes',
      value:
        this.refundDays() === 1 ? '1 day left' : `${this.refundDays()} days left`,
    },
  ]);

  readonly dueLabel = computed(() => {
    const invoice = this.invoice();
    if (!invoice?.dueDate) return null;
    return new Date(invoice.dueDate).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  });

  constructor() {
    addIcons(PAYMENT_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.invoiceId.set(id);
      if (id) this._load(id);
    });
  }

  send(): void {
    this._mutate((id) => this._invoiceService.send(id), 'Sent to the client', () =>
      this.sendOpen.set(false),
    );
  }

  markPaid(): void {
    this._mutate((id) => this._invoiceService.markPaid(id), 'Marked as paid', () =>
      this.markPaidOpen.set(false),
    );
  }

  voidInvoice(): void {
    this._mutate((id) => this._invoiceService.void(id), 'Invoice voided', () =>
      this.voidOpen.set(false),
    );
  }

  /**
   * A refund is issued against a *payment*, and an invoice carries no pointer
   * to one — so the payment is resolved first, by asking for the payments that
   * settled this invoice.
   */
  refund(): void {
    const invoice = this.invoice();
    if (!invoice || this.acting()) return;
    this.acting.set(true);

    this._earningsService
      .getPayments({ invoiceId: invoice.id, limit: 1 })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const payment = response.items[0];
          if (!payment) {
            this.acting.set(false);
            void this._feedbackService.error(
              null,
              'No payment found for this invoice to refund.',
            );
            return;
          }
          this._refundService
            .create({ paymentId: payment.id, amountCents: payment.amountCents })
            .pipe(take(1))
            .subscribe({
              next: () => {
                this.acting.set(false);
                this.refundOpen.set(false);
                void this._feedbackService.success('Refund issued');
                this._load(invoice.id);
              },
              error: (error: unknown) => {
                this.acting.set(false);
                void this._feedbackService.error(error, 'Could not issue the refund.');
              },
            });
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'Could not find the payment.');
        },
      });
  }

  openPdf(): void {
    const url = this.invoice()?.invoicePdf;
    if (url) window.open(url, '_blank', 'noopener');
  }

  retry(): void {
    const id = this.invoiceId();
    if (id) this._load(id);
  }

  private _load(invoiceId: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this._invoiceService
      .get(invoiceId)
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

  /**
   * Line items are not mirrored locally — they come from Stripe on demand. A
   * failure here is not the screen's failure: the amount block is the invoice,
   * so the section simply does not render.
   */
  private _loadItems(invoiceId: string): void {
    this._invoiceService
      .getLineItems(invoiceId)
      .pipe(take(1))
      .subscribe({
        next: (items) => this.items.set(items),
        error: () => this.items.set([]),
      });
  }

  private _mutate(
    call: (id: string) => Observable<unknown>,
    success: string,
    close: () => void,
  ): void {
    const id = this.invoiceId();
    if (!id || this.acting()) return;
    this.acting.set(true);

    call(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.acting.set(false);
          close();
          void this._feedbackService.success(success);
          this._load(id);
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'That did not go through.');
        },
      });
  }
}
