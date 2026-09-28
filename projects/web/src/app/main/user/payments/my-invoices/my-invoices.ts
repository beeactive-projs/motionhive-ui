import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ClientPaymentService,
  InvoiceStatuses,
  CurrencyRonPipe,
  EnumLabelPipe,
  StatusLabelPipe,
  getInvoiceStatusSeverity,
  type Invoice,
  type InvoiceStatus,
} from 'core';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

@Component({
  selector: 'mh-my-invoices',
  imports: [
    DatePipe,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    CurrencyRonPipe,
    EnumLabelPipe,
    StatusLabelPipe,
    ListEmptyState,
  ],
  providers: [MessageService],
  templateUrl: './my-invoices.html',
  styleUrl: './my-invoices.scss',
})
export class MyInvoices implements OnInit {
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  invoices = signal<Invoice[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  /** PrimeNG fills these placeholders itself, so the message keeps them literal. */
  readonly pageReportParams = { first: '{first}', last: '{last}', totalRecords: '{totalRecords}' };

  statusFilter = signal<InvoiceStatus | undefined>(undefined);
  /** `undefined` = no filter ("All"); the template labels the rest via `enumLabel`. */
  readonly statusOptions: (InvoiceStatus | undefined)[] = [
    undefined,
    InvoiceStatuses.Open,
    InvoiceStatuses.Paid,
    InvoiceStatuses.Void,
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
            summary: this._translateService.instant('toast.summary.error'),
            detail: this._translateService.instant('billing.myInvoices.toast.loadFailed'),
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
