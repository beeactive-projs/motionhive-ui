import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  EarningsService,
  StripeOnboardingService,
  StripeOnboardingStore,
  PaymentStatuses,
  TagSeverity,
  CurrencyRonPipe,
  StatusLabelPipe,
  showApiError,
  type EarningsSummary,
  type Payment,
  type PaymentStatus,
} from 'core';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

@Component({
  selector: 'mh-earnings',
  imports: [
    DatePipe,
    ButtonDirective,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    MessageModule,
    CurrencyRonPipe,
    StatusLabelPipe,
    ListEmptyState,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './earnings.html',
  styleUrl: './earnings.scss',
})
export class Earnings implements OnInit {
  private readonly _earningsService = inject(EarningsService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _onboardingStore = inject(StripeOnboardingStore);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  /**
   * PrimeNG fills `{first}` / `{last}` / `{totalRecords}` into the page
   * report itself, so the translated template keeps those placeholders.
   */
  readonly pageReportParams = { first: '{first}', last: '{last}', total: '{totalRecords}' };

  readonly dashboardLoading = signal(false);
  // Read directly from the shared store — no per-page fetch needed.
  readonly stripeOnboarded = this._onboardingStore.canIssueInvoices;
  readonly hasStripeAccount = this._onboardingStore.hasAccount;

  summary = signal<EarningsSummary | null>(null);
  summaryLoading = signal(true);

  payments = signal<Payment[]>([]);
  paymentsTotalRecords = signal(0);
  paymentsLoading = signal(true);

  readonly paymentsRows = 10;
  paymentsPage = signal(1);

  readonly Statuses = PaymentStatuses;

  ngOnInit(): void {
    this._onboardingStore.ensureLoaded();
    this.loadSummary();
    this.loadPayments();
  }

  startOnboarding(): void {
    this._onboardingService.start().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('payments.earnings.toast.startOnboardingFailed'),
        });
      },
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this._earningsService.getSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('payments.earnings.toast.loadSummaryFailed'),
        });
      },
    });
  }

  loadPayments(): void {
    this.paymentsLoading.set(true);
    this._earningsService
      .getPayments({ page: this.paymentsPage(), limit: this.paymentsRows })
      .subscribe({
        next: (response) => {
          this.payments.set(response.items);
          this.paymentsTotalRecords.set(response.total);
          this.paymentsLoading.set(false);
        },
        error: () => {
          this.paymentsLoading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: this._translateService.instant('toast.summary.error'),
            detail: this._translateService.instant('payments.earnings.toast.loadPaymentsFailed'),
          });
        },
      });
  }

  onPaymentsPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.paymentsRows;
    this.paymentsPage.set(Math.floor(first / rows) + 1);
    this.loadPayments();
  }

  paymentStatusSeverity(status: PaymentStatus): TagSeverity {
    switch (status) {
      case PaymentStatuses.Succeeded:
        return TagSeverity.Success;
      case PaymentStatuses.Pending:
        return TagSeverity.Warn;
      case PaymentStatuses.Failed:
        return TagSeverity.Danger;
      case PaymentStatuses.Refunded:
        return TagSeverity.Info;
      default:
        return TagSeverity.Secondary;
    }
  }

  openStripeDashboard(): void {
    this.dashboardLoading.set(true);
    this._onboardingService.getDashboardLink().subscribe({
      next: (res) => {
        this.dashboardLoading.set(false);
        window.open(res.url, '_blank');
      },
      error: (err) => {
        this.dashboardLoading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('payments.common.openDashboardFailed'),
          err,
        );
      },
    });
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
