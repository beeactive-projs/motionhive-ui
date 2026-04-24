import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { DataView } from 'primeng/dataview';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  InvoiceService as PaymentInvoiceService,
  InvoiceStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getInvoiceStatusSeverity,
  type Invoice,
  type InvoiceStatus,
} from 'core';
import { CreateInvoiceDialog } from '../../_dialogs/create-invoice-dialog/create-invoice-dialog';
import { SendInvoiceEmailDialog } from '../../_dialogs/send-invoice-email-dialog/send-invoice-email-dialog';
import { ListCard } from '../../../../_shared/components/list-card/list-card';

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
export class Invoices implements OnInit {
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _scrollSentinel = viewChild<ElementRef>('scrollSentinel');
  private _observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && this.hasMore() && !this.loadingMore() && !this.loading()) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

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

  readonly Statuses = InvoiceStatuses;

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading.set(true);
    this._invoiceService
      .list({
        status: this.statusFilter(),
        page: this.currentPage(),
        limit: this.rows,
      })
      .subscribe({
        next: (response) => {
          this.invoices.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load invoices',
          });
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadInvoices();
  }

  onStatusFilterChange(status: InvoiceStatus | undefined): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadInvoices();
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
      .subscribe({
        next: (response) => {
          this.invoices.update((list) => [...list, ...response.items]);
          this.totalRecords.set(response.total);
          this.currentPage.update((p) => p + 1);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load more invoices',
          });
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
    this._invoiceService.void(invoice.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice voided',
          detail: `Invoice ${invoice.number ?? ''} has been voided`,
        });
        this.loadInvoices();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to void invoice',
        });
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
    this._invoiceService.markPaid(invoice.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice marked paid',
          detail: 'Invoice has been marked as paid (out of band)',
        });
        this.loadInvoices();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to mark invoice as paid',
        });
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
