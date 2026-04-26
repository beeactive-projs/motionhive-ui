import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  CurrencyRonPipe,
  getInvoiceStatusSeverity,
  InvoiceStatuses,
  InvoiceService as PaymentInvoiceService,
  showApiError,
  StatusLabelPipe,
  type Invoice,
  type InvoiceStatus,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DataView } from 'primeng/dataview';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { catchError, of, startWith, Subject, switchMap, take } from 'rxjs';
import { ListCard } from '../../../../_shared/components/list-card/list-card';
import { CreateInvoiceDialog } from '../../_dialogs/create-invoice-dialog/create-invoice-dialog';
import { SendInvoiceEmailDialog } from '../../_dialogs/send-invoice-email-dialog/send-invoice-email-dialog';

@Component({
  selector: 'mh-invoices',
  imports: [
    DatePipe,
    RouterLink,
    Button,
    TableModule,
    Tag,
    SkeletonModule,
    ToastModule,
    ConfirmDialog,
    Tooltip,
    CurrencyRonPipe,
    StatusLabelPipe,
    DataView,
    CreateInvoiceDialog,
    SendInvoiceEmailDialog,
    ListCard,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invoices {
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _scrollSentinel = viewChild<ElementRef>('scrollSentinel');
  private _observer?: IntersectionObserver;

  private readonly _reload$ = new Subject<void>();

  readonly invoices = signal<Invoice[]>([]);
  readonly totalRecords = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);

  readonly rows = 10;
  readonly currentPage = signal(1);

  readonly hasMore = computed(() => this.invoices().length < this.totalRecords());

  readonly statusFilter = signal<InvoiceStatus | undefined>(undefined);
  readonly statusOptions = [
    { label: 'All', value: undefined },
    { label: 'Draft', value: InvoiceStatuses.Draft as InvoiceStatus },
    { label: 'Open', value: InvoiceStatuses.Open as InvoiceStatus },
    { label: 'Paid', value: InvoiceStatuses.Paid as InvoiceStatus },
    { label: 'Void', value: InvoiceStatuses.Void as InvoiceStatus },
  ];

  readonly showCreateDialog = signal(false);
  readonly showSendDialog = signal(false);
  readonly sendDialogInvoice = signal<Invoice | null>(null);

  /**
   * Non-null when the create-invoice dialog should open in EDIT mode for
   * a specific draft. Cleared on dialog close so the next "Create"
   * click reopens the new-invoice flow cleanly.
   */
  readonly editingInvoiceId = signal<string | null>(null);

  readonly Statuses = InvoiceStatuses;

  constructor() {
    this._reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          return this._invoiceService
            .list({
              status: this.statusFilter(),
              page: this.currentPage(),
              limit: this.rows,
            })
            .pipe(
              catchError((err) => {
                showApiError(this._messageService, 'Error', 'Failed to load invoices', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        if (response) {
          this.invoices.set(response.items);
          this.totalRecords.set(response.total);
        }
        this.loading.set(false);
        this.loadingMore.set(false);
      });

    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  reload(): void {
    this._reload$.next();
  }

  openEdit(invoice: Invoice): void {
    this.editingInvoiceId.set(invoice.id);
    this.showCreateDialog.set(true);
  }

  onCreateDialogVisibleChange(open: boolean): void {
    this.showCreateDialog.set(open);
    if (!open) {
      // Reset edit context when the dialog closes so the NEXT "Create
      // invoice" click goes through the create flow, not edit.
      this.editingInvoiceId.set(null);
      // Safety net: refresh the list whenever the dialog closes. The
      // dialog also emits (saved) on success which independently
      // triggers onSavedFromDialog(), so this is mostly belt-and-braces
      // for the case where another tab created/edited an invoice while
      // this dialog was open.
      this.reload();
    }
  }

  /**
   * Called when the create-invoice dialog reports a successful save.
   * Resets pagination to page 1 so the freshly-created row is visible
   * even if the user was paging through results when they opened the
   * dialog. The filter chip is left as-is — overriding the user's
   * intent feels disrespectful, and they can clear it themselves if
   * they don't see the new row (a Send-immediately invoice goes to
   * OPEN, not DRAFT, so a "Draft" filter would hide it).
   */
  onSavedFromDialog(): void {
    this.currentPage.set(1);
    this.reload();
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.reload();
  }

  onStatusFilterChange(status: InvoiceStatus | undefined): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.reload();
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this._invoiceService
      .list({
        status: this.statusFilter(),
        page: this.currentPage() + 1,
        limit: this.rows,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.invoices.update((list) => [...list, ...response.items]);
          this.totalRecords.set(response.total);
          this.currentPage.update((p) => p + 1);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loadingMore.set(false);
          showApiError(this._messageService, 'Error', 'Failed to load more invoices', err);
        },
      });
  }

  openSendDialog(invoice: Invoice): void {
    this.sendDialogInvoice.set(invoice);
    this.showSendDialog.set(true);
  }

  confirmVoid(invoice: Invoice): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to void invoice ${invoice.number ?? ''}? This cannot be undone.`,
      header: 'Void invoice',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.voidInvoice(invoice),
    });
  }

  private voidInvoice(invoice: Invoice): void {
    this._invoiceService
      .void(invoice.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'Invoice voided',
            detail: `Invoice ${invoice.number ?? ''} has been voided`,
          });
          this.reload();
        },
        error: (err) => {
          showApiError(this._messageService, 'Error', 'Failed to void invoice', err);
        },
      });
  }

  confirmMarkPaid(invoice: Invoice): void {
    this._confirmationService.confirm({
      message: `Mark this invoice as paid out of band (cash or bank transfer)? No Stripe fees will be charged.`,
      header: 'Mark as paid',
      icon: 'pi pi-info-circle',
      accept: () => this.markPaid(invoice),
    });
  }

  private markPaid(invoice: Invoice): void {
    this._invoiceService
      .markPaid(invoice.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'Invoice marked paid',
            detail: 'Invoice has been marked as paid (out of band)',
          });
          this.reload();
        },
        error: (err) => {
          showApiError(this._messageService, 'Error', 'Failed to mark invoice as paid', err);
        },
      });
  }

  readonly statusSeverity = getInvoiceStatusSeverity;

  clientDisplay(invoice: Invoice): string {
    if (invoice.client?.firstName && invoice.client?.lastName) {
      return `${invoice.client.firstName} ${invoice.client.lastName}`;
    }
    return invoice.clientEmail ?? 'Unknown';
  }

  clientInitials(invoice: Invoice): string {
    if (invoice.client?.firstName && invoice.client?.lastName) {
      return (invoice.client.firstName.charAt(0) + invoice.client.lastName.charAt(0)).toUpperCase();
    }
    if (invoice.clientEmail) {
      return invoice.clientEmail.charAt(0).toUpperCase();
    }
    return '?';
  }

  invoiceDisplayNumber(invoice: Invoice): string {
    return invoice.number ?? `#${invoice.id.slice(0, 8).toUpperCase()}`;
  }

  isOverdue(invoice: Invoice): boolean {
    if (invoice.status !== InvoiceStatuses.Open) return false;
    if (!invoice.dueDate) return false;
    return new Date(invoice.dueDate).getTime() < Date.now();
  }

  cardAccent(invoice: Invoice): 'none' | 'primary' | 'danger' | 'success' {
    if (this.isOverdue(invoice)) return 'danger';
    if (invoice.status === InvoiceStatuses.Paid) return 'success';
    return 'none';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
