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
import { MessageService } from 'primeng/api';
import {
  ClientPaymentService,
  InvoiceStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getInvoiceStatusSeverity,
  type Invoice,
  type InvoiceStatus,
} from 'core';

@Component({
  selector: 'mh-my-invoices',
  imports: [
    DatePipe,
    RouterLink,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    CurrencyRonPipe,
    StatusLabelPipe,
  ],
  providers: [MessageService],
  templateUrl: './my-invoices.html',
  styleUrl: './my-invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyInvoices implements OnInit {
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);

  invoices = signal<Invoice[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  statusFilter = signal<InvoiceStatus | undefined>(undefined);
  readonly statusOptions: { label: string; value: InvoiceStatus | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Open', value: InvoiceStatuses.Open },
    { label: 'Paid', value: InvoiceStatuses.Paid },
    { label: 'Void', value: InvoiceStatuses.Void },
  ];

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading.set(true);
    this._clientPaymentService
      .getMyInvoices({
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

  readonly statusSeverity = getInvoiceStatusSeverity;

  trackById = (_: number, item: { id: string }) => item.id;
}
