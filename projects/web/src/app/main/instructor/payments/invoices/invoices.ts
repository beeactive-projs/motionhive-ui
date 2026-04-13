import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  InvoiceService as PaymentInvoiceService,
  InvoiceStatuses,
  StripeOnboardingService,
  TagSeverity,
  CurrencyRonPipe,
  type Invoice,
  type InvoiceStatus,
} from 'core';
import { CreateInvoiceDialog } from '../../_dialogs/create-invoice-dialog/create-invoice-dialog';

@Component({
  selector: 'mh-invoices',
  imports: [
    DatePipe,
    RouterLink,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    MessageModule,
    CurrencyRonPipe,
    CreateInvoiceDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invoices implements OnInit {
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly stripeOnboarded = signal(false);

  invoices = signal<Invoice[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  statusFilter = signal<InvoiceStatus | undefined>(undefined);
  readonly statusOptions = [
    { label: 'All', value: undefined },
    { label: 'Draft', value: InvoiceStatuses.Draft as InvoiceStatus },
    { label: 'Open', value: InvoiceStatuses.Open as InvoiceStatus },
    { label: 'Paid', value: InvoiceStatuses.Paid as InvoiceStatus },
    { label: 'Void', value: InvoiceStatuses.Void as InvoiceStatus },
  ];

  showCreateDialog = signal(false);

  readonly Statuses = InvoiceStatuses;

  ngOnInit(): void {
    this.loadOnboardingStatus();
    this.loadInvoices();
  }

  private loadOnboardingStatus(): void {
    this._onboardingService.getStatus().subscribe({
      next: (res) => this.stripeOnboarded.set(!!res.account?.chargesEnabled),
      error: () => this.stripeOnboarded.set(false),
    });
  }

  startOnboarding(): void {
    this._onboardingService.start().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to start Stripe onboarding',
        });
      },
    });
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
        },
        error: () => {
          this.loading.set(false);
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

  sendInvoice(invoice: Invoice): void {
    this._invoiceService.send(invoice.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice sent',
          detail: `Invoice ${invoice.number ?? ''} has been sent`,
        });
        this.loadInvoices();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to send invoice',
        });
      },
    });
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

  clientDisplay(invoice: Invoice): string {
    if (invoice.client?.firstName && invoice.client?.lastName) {
      return `${invoice.client.firstName} ${invoice.client.lastName}`;
    }
    return invoice.clientEmail ?? 'Unknown';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
