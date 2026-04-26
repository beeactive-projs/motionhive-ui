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
import { Tooltip } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  ClientPaymentService,
  CurrencyRonPipe,
  StatusLabelPipe,
  SubscriptionStatuses,
  getSubscriptionStatusSeverity,
  type Subscription,
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
    Tooltip,
    ConfirmDialogModule,
    CurrencyRonPipe,
    StatusLabelPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './my-subscriptions.html',
  styleUrl: './my-subscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySubscriptions implements OnInit {
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  subscriptions = signal<Subscription[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  portalLoading = signal(false);
  /** Per-row cancel-in-flight set so spamming the button doesn't double-fire. */
  cancellingId = signal<string | null>(null);

  readonly rows = 10;
  currentPage = signal(1);

  readonly Statuses = SubscriptionStatuses;

  /**
   * Plan label for the table cell. Falls back gracefully when the
   * eager-loaded product join didn't return (legacy rows).
   */
  planLabel(sub: Subscription): string {
    const p = sub.product;
    if (p?.name) {
      const cadence = p.interval
        ? p.intervalCount && p.intervalCount > 1
          ? ` · every ${p.intervalCount} ${p.interval}s`
          : ` · ${p.interval}ly`
        : '';
      return `${p.name}${cadence}`;
    }
    // Hide raw UUIDs from the user — they're meaningless to a non-dev.
    return 'Membership';
  }

  /** True when this row should expose a Cancel button. */
  canCancel(sub: Subscription): boolean {
    return (
      (sub.status === SubscriptionStatuses.Active ||
        sub.status === SubscriptionStatuses.Trialing) &&
      !sub.cancelAtPeriodEnd
    );
  }

  /**
   * Confirm + cancel one of my subscriptions. Always at-period-end on
   * the server: the client keeps access through the rest of the cycle
   * they already paid for. We surface that fact in the confirm copy.
   */
  confirmCancel(sub: Subscription): void {
    if (!this.canCancel(sub)) return;
    const endLabel = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'the end of the current period';
    this._confirmationService.confirm({
      message: `Your membership will end on ${endLabel}. You'll keep access until then. Continue?`,
      header: 'Cancel membership',
      icon: 'pi pi-info-circle',
      accept: () => this.runCancel(sub),
    });
  }

  private runCancel(sub: Subscription): void {
    this.cancellingId.set(sub.id);
    this._clientPaymentService.cancelMySubscription(sub.id).subscribe({
      next: (updated) => {
        this.cancellingId.set(null);
        // Patch the row in place so the user sees the new state without
        // a full reload.
        this.subscriptions.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        this._messageService.add({
          severity: 'success',
          summary: 'Cancellation scheduled',
          detail: 'Your membership will end at the close of the current period.',
        });
      },
      error: (err) => {
        this.cancellingId.set(null);
        this._messageService.add({
          severity: 'error',
          summary: 'Could not cancel',
          detail: err.error?.message || 'Please try again in a moment.',
        });
      },
    });
  }

  ngOnInit(): void {
    this.loadSubscriptions();
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

  readonly statusSeverity = getSubscriptionStatusSeverity;

  trackById = (_: number, item: { id: string }) => item.id;
}
