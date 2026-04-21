import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
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
  TagSeverity,
  CurrencyRonPipe,
  type Invoice,
  type InvoiceLineItemDetail,
  type InvoiceStatus,
} from 'core';

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
    ButtonModule,
    TagModule,
    SkeletonModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
    Tooltip,
    Menu,
    CurrencyRonPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly invoice = signal<Invoice | null>(null);
  readonly lineItems = signal<InvoiceLineItemDetail[]>([]);
  readonly lineItemsLoading = signal(false);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);

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
      label: 'Draft',
      date: inv.createdAt,
      state: 'done',
    };
    const sent: TrackerStep = {
      key: 'sent',
      label: 'Sent',
      date: inv.finalizedAt,
      state: inv.finalizedAt ? 'done' : 'pending',
    };
    const paid: TrackerStep = {
      key: 'paid',
      label: 'Paid',
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
    const events: ActivityEntry[] = [
      { label: 'Draft created', at: inv.createdAt, kind: 'neutral' },
    ];
    if (inv.finalizedAt) {
      events.push({ label: 'Invoice sent', at: inv.finalizedAt, kind: 'neutral' });
    }
    if (inv.paidAt) {
      events.push({ label: 'Invoice paid', at: inv.paidAt, kind: 'success' });
    }
    if (inv.voidedAt) {
      events.push({ label: 'Invoice voided', at: inv.voidedAt, kind: 'danger' });
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
    return inv.clientEmail ?? 'Guest';
  });

  /** Overflow menu for secondary actions (hosted page, PDF). */
  readonly overflowMenu = computed<MenuItem[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const items: MenuItem[] = [];
    if (inv.hostedInvoiceUrl) {
      items.push({
        label: 'Open hosted page',
        icon: 'pi pi-external-link',
        command: () => window.open(inv.hostedInvoiceUrl!, '_blank'),
      });
    }
    if (inv.invoicePdf) {
      items.push({
        label: 'Download PDF',
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
          summary: 'Error',
          detail: 'Invoice not found',
        });
        this.goBackToList();
      },
    });
  }

  sendInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    this.actionLoading.set(true);
    this._invoiceService.send(inv.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.actionLoading.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice sent',
          detail: 'Invoice has been finalized and sent',
        });
      },
      error: (err) => {
        this.actionLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to send invoice',
        });
      },
    });
  }

  confirmVoid(): void {
    const inv = this.invoice();
    if (!inv) return;
    this._confirmationService.confirm({
      message:
        'Are you sure you want to void this invoice? This cannot be undone.',
      header: 'Void invoice',
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
              summary: 'Invoice voided',
            });
          },
          error: (err) => {
            this.actionLoading.set(false);
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to void invoice',
            });
          },
        });
      },
    });
  }

  confirmMarkPaid(): void {
    const inv = this.invoice();
    if (!inv) return;
    this._confirmationService.confirm({
      message:
        'Mark this invoice as paid out of band (cash or bank transfer)?',
      header: 'Mark as paid',
      icon: 'pi pi-info-circle',
      accept: () => {
        this.actionLoading.set(true);
        this._invoiceService.markPaid(inv.id).subscribe({
          next: (updated) => {
            this.invoice.set(updated);
            this.actionLoading.set(false);
            this._messageService.add({
              severity: 'success',
              summary: 'Invoice marked paid',
            });
          },
          error: (err) => {
            this.actionLoading.set(false);
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to mark as paid',
            });
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
          summary: 'Copied',
          detail: 'Payment link copied to clipboard',
        }),
      () =>
        this._messageService.add({
          severity: 'error',
          summary: 'Copy failed',
          detail: 'Select and copy the link manually.',
        }),
    );
  }

  statusSeverity(status: InvoiceStatus): TagSeverity {
    switch (status) {
      case InvoiceStatuses.Paid:
        return TagSeverity.Success;
      case InvoiceStatuses.Open:
        return TagSeverity.Warn;
      case InvoiceStatuses.Draft:
        return TagSeverity.Secondary;
      case InvoiceStatuses.Void:
      case InvoiceStatuses.Uncollectible:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }
}
