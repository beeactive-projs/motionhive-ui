import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
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
  appLocale,
  getSubscriptionStatusSeverity,
  showApiError,
  type Subscription,
} from 'core';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

@Component({
  selector: 'mh-my-subscriptions',
  imports: [
    DatePipe,
    TranslatePipe,
    ButtonDirective,
    TableModule,
    TagModule,
    CardModule,
    SkeletonModule,
    ToastModule,
    Tooltip,
    ConfirmDialogModule,
    CurrencyRonPipe,
    StatusLabelPipe,
    ListEmptyState,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './my-subscriptions.html',
  styleUrl: './my-subscriptions.scss',
})
export class MySubscriptions implements OnInit {
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

  subscriptions = signal<Subscription[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  portalLoading = signal(false);
  /** Per-row cancel-in-flight set so spamming the button doesn't double-fire. */
  cancellingId = signal<string | null>(null);

  readonly rows = 10;
  currentPage = signal(1);

  readonly Statuses = SubscriptionStatuses;

  /** PrimeNG fills these placeholders itself, so the message keeps them literal. */
  readonly pageReportParams = { first: '{first}', last: '{last}', totalRecords: '{totalRecords}' };

  /**
   * Plan label for the table cell. Falls back gracefully when the
   * eager-loaded product join didn't return (legacy rows).
   */
  planLabel(sub: Subscription): string {
    const p = sub.product;
    if (p?.name) {
      if (!p.interval) return p.name;
      const cadence = this._translateService.instant('time.cadence', {
        interval: p.interval,
        count: p.intervalCount ?? 1,
      });
      return this._translateService.instant('billing.mySubscriptions.planWithCadence', {
        name: p.name,
        cadence,
      });
    }
    // Hide raw UUIDs from the user — they're meaningless to a non-dev.
    return this._translateService.instant('billing.mySubscriptions.membership');
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
    const message = sub.currentPeriodEnd
      ? this._translateService.instant('billing.mySubscriptions.confirmCancel.message', {
          date: new Date(sub.currentPeriodEnd).toLocaleDateString(appLocale(), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        })
      : this._translateService.instant('billing.mySubscriptions.confirmCancel.messageNoDate');
    this._confirmationService.confirm({
      message,
      header: this._translateService.instant('billing.mySubscriptions.confirmCancel.header'),
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
          summary: this._translateService.instant('billing.mySubscriptions.toast.cancelScheduled.summary'),
          detail: this._translateService.instant('billing.mySubscriptions.toast.cancelScheduled.detail'),
        });
      },
      error: (err: unknown) => {
        this.cancellingId.set(null);
        showApiError(
          this._messageService,
          this._translateService.instant('billing.mySubscriptions.toast.cancelFailed.summary'),
          this._translateService.instant('billing.mySubscriptions.toast.cancelFailed.detail'),
          err,
        );
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
            summary: this._translateService.instant('toast.summary.error'),
            detail: this._translateService.instant('billing.mySubscriptions.toast.loadFailed'),
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
      error: (err: unknown) => {
        this.portalLoading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('billing.mySubscriptions.toast.portalFailed'),
          err,
        );
      },
    });
  }

  readonly statusSeverity = getSubscriptionStatusSeverity;

  trackById = (_: number, item: { id: string }) => item.id;
}
