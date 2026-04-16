import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  InvoiceService as PaymentInvoiceService,
  InvoiceStatuses,
  TagSeverity,
  CurrencyRonPipe,
  type Invoice,
  type InvoiceLineItemDetail,
  type InvoiceStatus,
} from 'core';

@Component({
  selector: 'mh-invoice-detail',
  imports: [
    DatePipe,
    RouterLink,
    ButtonModule,
    CardModule,
    TagModule,
    SkeletonModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
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

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/payments/invoices']);
      return;
    }
    this.loadInvoice(id);
    this.loadLineItems(id);
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
        this._router.navigate(['/payments/invoices']);
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
      message: 'Are you sure you want to void this invoice? This cannot be undone.',
      header: 'Void invoice',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.actionLoading.set(true);
        this._invoiceService.void(inv.id).subscribe({
          next: (updated) => {
            this.invoice.set(updated);
            this.actionLoading.set(false);
            this._messageService.add({ severity: 'success', summary: 'Invoice voided' });
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
      message: 'Mark this invoice as paid out of band (cash or bank transfer)?',
      header: 'Mark as paid',
      icon: 'pi pi-info-circle',
      accept: () => {
        this.actionLoading.set(true);
        this._invoiceService.markPaid(inv.id).subscribe({
          next: (updated) => {
            this.invoice.set(updated);
            this.actionLoading.set(false);
            this._messageService.add({ severity: 'success', summary: 'Invoice marked paid' });
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
