import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { Menu } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import {
  InvoiceService as PaymentInvoiceService,
  InvoiceStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getInvoiceStatusSeverity,
  showApiError,
  type Invoice,
  type InvoiceLineItemDetail,
} from 'core';
import { SendInvoiceEmailDialog } from '../../../_dialogs/send-invoice-email-dialog/send-invoice-email-dialog';

/**
 * One step in the invoice lifecycle tracker. Tracker is 3 steps:
 *   Draft → Sent → Paid
 * Void is terminal but NOT rendered as a step — it shows as a status
 * pill on the hero instead.
 */
interface TrackerStep {
  key: 'draft' | 'sent' | 'paid';
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'pending';
}

/** Single entry in the right-hand activity feed. */
interface ActivityEntry {
  label: string;
  at: string;
  kind: 'neutral' | 'success' | 'warn' | 'danger';
}

@Component({
  selector: 'mh-invoice-detail',
  imports: [
    DatePipe,
    RouterLink,
    ButtonDirective,
    TagModule,
    SkeletonModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
    Tooltip,
    Menu,
    CurrencyRonPipe,
    StatusLabelPipe,
    SendInvoiceEmailDialog,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
})
export class InvoiceDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

  readonly invoice = signal<Invoice | null>(null);
  readonly lineItems = signal<InvoiceLineItemDetail[]>([]);
  readonly lineItemsLoading = signal(false);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly showSendDialog = signal(false);

  readonly Statuses = InvoiceStatuses;

  /** Display label for the hero (e.g. "MH-0001" or "#DEMO1234"). */
  readonly displayNumber = computed(() => {
    const inv = this.invoice();
    if (!inv) return '';
    return inv.number ?? `#${inv.id.slice(0, 8).toUpperCase()}`;
  });

  /**
   * 3-step tracker state computed from the invoice's timestamps.
   * We intentionally do NOT show "viewed" because emailed invoices can't
   * be reliably tracked as viewed.
   */
  readonly tracker = computed<TrackerStep[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];

    const draft: TrackerStep = {
      key: 'draft',
      label: this._translateService.instant('payments.invoiceDetail.tracker.draft'),
      date: inv.createdAt,
      state: 'done',
    };
    const sent: TrackerStep = {
      key: 'sent',
      label: this._translateService.instant('payments.invoiceDetail.tracker.sent'),
      date: inv.finalizedAt,
      state: inv.finalizedAt ? 'done' : 'pending',
    };
    const paid: TrackerStep = {
      key: 'paid',
      label: this._translateService.instant('payments.invoiceDetail.tracker.paid'),
      date: inv.paidAt,
      state: inv.paidAt ? 'done' : 'pending',
    };

    // First pending step becomes "current" so the UI highlights what's next.
    if (sent.state === 'pending') {
      sent.state = 'current';
    } else if (paid.state === 'pending') {
      paid.state = 'current';
    }

    return [draft, sent, paid];
  });

  /**
   * Ordered activity log — newest first. Derived from the invoice's
   * lifecycle timestamps since we don't have a dedicated event table.
   */
  readonly activity = computed<ActivityEntry[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const t = (key: string) => this._translateService.instant(`payments.invoiceDetail.activity.${key}`);
    const events: ActivityEntry[] = [
      { label: t('draftCreated'), at: inv.createdAt, kind: 'neutral' },
    ];
    if (inv.finalizedAt) {
      events.push({ label: t('invoiceSent'), at: inv.finalizedAt, kind: 'neutral' });
    }
    if (inv.paidAt) {
      events.push({ label: t('invoicePaid'), at: inv.paidAt, kind: 'success' });
    }
    if (inv.voidedAt) {
      events.push({ label: t('invoiceVoided'), at: inv.voidedAt, kind: 'danger' });
    }
    return events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  });

  readonly clientName = computed(() => {
    const inv = this.invoice();
    if (!inv) return '';
    const c = inv.client;
    if (c?.firstName) {
      return `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`;
    }
    return inv.clientEmail ?? this._translateService.instant('payments.invoiceDetail.guest');
  });

  /** Overflow menu for secondary actions (hosted page, PDF). */
  readonly overflowMenu = computed<MenuItem[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const items: MenuItem[] = [];
    if (inv.hostedInvoiceUrl) {
      items.push({
        label: this._translateService.instant('payments.invoiceDetail.action.openHostedPage'),
        icon: 'pi pi-external-link',
        command: () => window.open(inv.hostedInvoiceUrl!, '_blank'),
      });
    }
    if (inv.invoicePdf) {
      items.push({
        label: this._translateService.instant('payments.invoiceDetail.action.downloadPdf'),
        icon: 'pi pi-download',
        command: () => window.open(inv.invoicePdf!, '_blank'),
      });
    }
    return items;
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBackToList();
      return;
    }
    this.loadInvoice(id);
    this.loadLineItems(id);
  }

  goBackToList(): void {
    this._router.navigate(['/coaching/payments'], {
      queryParams: { tab: 'invoices' },
    });
  }

  private loadLineItems(id: string): void {
    this.lineItemsLoading.set(true);
    this._invoiceService.getLineItems(id).subscribe({
      next: (items) => {
        this.lineItems.set(items);
        this.lineItemsLoading.set(false);
      },
      error: () => {
        this.lineItems.set([]);
        this.lineItemsLoading.set(false);
      },
    });
  }

  private loadInvoice(id: string): void {
    this.loading.set(true);
    this._invoiceService.get(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('payments.invoiceDetail.toast.notFound'),
        });
        this.goBackToList();
      },
    });
  }

  /** Opens the send-email popup so the instructor can confirm/override
   *  the recipient before finalizing and sending. */
  openSendDialog(): void {
    if (!this.invoice()) return;
    this.showSendDialog.set(true);
  }

  /** Callback for when the send popup finishes — re-fetch so the hero
   *  tracker + activity feed reflect the new Open state. */
  onSent(): void {
    const inv = this.invoice();
    if (!inv) return;
    this._invoiceService.get(inv.id).subscribe({
      next: (updated) => this.invoice.set(updated),
    });
  }

  confirmVoid(): void {
    const inv = this.invoice();
    if (!inv) return;
    this._confirmationService.confirm({
      message: this._translateService.instant('payments.invoiceDetail.confirm.void.message'),
      header: this._translateService.instant('payments.invoiceDetail.confirm.void.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.actionLoading.set(true);
        this._invoiceService.void(inv.id).subscribe({
          next: (updated) => {
            this.invoice.set(updated);
            this.actionLoading.set(false);
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('payments.invoiceDetail.toast.voided'),
            });
          },
          error: (err) => {
            this.actionLoading.set(false);
            showApiError(
              this._messageService,
              this._translateService.instant('toast.summary.error'),
              this._translateService.instant('payments.invoiceDetail.toast.voidFailed'),
              err,
            );
          },
        });
      },
    });
  }

  confirmMarkPaid(): void {
    const inv = this.invoice();
    if (!inv) return;
    this._confirmationService.confirm({
      message: this._translateService.instant('payments.invoiceDetail.confirm.markPaid.message'),
      header: this._translateService.instant('payments.invoiceDetail.confirm.markPaid.header'),
      icon: 'pi pi-info-circle',
      accept: () => {
        this.actionLoading.set(true);
        this._invoiceService.markPaid(inv.id).subscribe({
          next: (updated) => {
            this.invoice.set(updated);
            this.actionLoading.set(false);
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('payments.invoiceDetail.toast.markedPaid'),
            });
          },
          error: (err) => {
            this.actionLoading.set(false);
            showApiError(
              this._messageService,
              this._translateService.instant('toast.summary.error'),
              this._translateService.instant('payments.invoiceDetail.toast.markPaidFailed'),
              err,
            );
          },
        });
      },
    });
  }

  copyPaymentLink(): void {
    const inv = this.invoice();
    if (!inv?.hostedInvoiceUrl) return;
    navigator.clipboard.writeText(inv.hostedInvoiceUrl).then(
      () =>
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.summary.copied'),
          detail: this._translateService.instant('payments.invoiceDetail.toast.linkCopied'),
        }),
      () =>
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('payments.common.copyFailed'),
          detail: this._translateService.instant('payments.common.copyManually'),
        }),
    );
  }

  readonly statusSeverity = getInvoiceStatusSeverity;
}
