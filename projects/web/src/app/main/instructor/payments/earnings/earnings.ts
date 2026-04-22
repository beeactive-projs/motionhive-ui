import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
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
  PaymentStatuses,
  TagSeverity,
  CurrencyRonPipe,
  type EarningsSummary,
  type Payment,
  type PaymentStatus,
} from 'core';

@Component({
  selector: 'mh-earnings',
  imports: [
    DatePipe,
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    MessageModule,
    CurrencyRonPipe,
  ],
  providers: [MessageService],
  templateUrl: './earnings.html',
  styleUrl: './earnings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Earnings implements OnInit {
  private readonly _earningsService = inject(EarningsService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);

  readonly dashboardLoading = signal(false);
  readonly stripeOnboarded = signal(false);

  summary = signal<EarningsSummary | null>(null);
  summaryLoading = signal(true);

  payments = signal<Payment[]>([]);
  paymentsTotalRecords = signal(0);
  paymentsLoading = signal(true);

  readonly paymentsRows = 10;
  paymentsPage = signal(1);

  readonly Statuses = PaymentStatuses;

  ngOnInit(): void {
    this.loadOnboardingStatus();
    this.loadSummary();
    this.loadPayments();
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
          summary: 'Error',
          detail: 'Failed to load earnings summary',
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
            summary: 'Error',
            detail: 'Failed to load payment history',
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
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to open Stripe Dashboard',
        });
      },
    });
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
