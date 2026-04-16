import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ClientPaymentService,
  SubscriptionStatuses,
  TagSeverity,
  CurrencyRonPipe,
  type Subscription,
  type SubscriptionStatus,
} from 'core';

@Component({
  selector: 'mh-my-subscriptions',
  imports: [
    DatePipe,
    ButtonModule,
    TableModule,
    TagModule,
    CardModule,
    SkeletonModule,
    ToastModule,
    CurrencyRonPipe,
  ],
  providers: [MessageService],
  templateUrl: './my-subscriptions.html',
  styleUrl: './my-subscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySubscriptions implements OnInit {
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);

  subscriptions = signal<Subscription[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  portalLoading = signal(false);

  readonly rows = 10;
  currentPage = signal(1);

  ngOnInit(): void {
    // this.loadSubscriptions();
  }

  loadSubscriptions(): void {
    this.loading.set(true);
    this._clientPaymentService
      .getMySubscriptions({
        page: this.currentPage(),
        limit: this.rows,
      })
      .subscribe({
        next: (response) => {
          this.subscriptions.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subscriptions',
          });
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadSubscriptions();
  }

  openCustomerPortal(): void {
    this.portalLoading.set(true);
    this._clientPaymentService.getPortalLink().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        this.portalLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to open customer portal',
        });
      },
    });
  }

  statusSeverity(status: SubscriptionStatus): TagSeverity {
    switch (status) {
      case SubscriptionStatuses.Active:
        return TagSeverity.Success;
      case SubscriptionStatuses.Trialing:
        return TagSeverity.Info;
      case SubscriptionStatuses.PastDue:
        return TagSeverity.Warn;
      case SubscriptionStatuses.Canceled:
      case SubscriptionStatuses.Unpaid:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  statusLabel(status: SubscriptionStatus): string {
    return status.replace('_', ' ');
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
