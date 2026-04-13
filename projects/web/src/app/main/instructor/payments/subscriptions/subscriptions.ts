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
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  SubscriptionService,
  SubscriptionStatuses,
  StripeOnboardingService,
  TagSeverity,
  CurrencyRonPipe,
  type Subscription,
  type SubscriptionStatus,
} from 'core';
import { CreateSubscriptionDialog } from '../../_dialogs/create-subscription-dialog/create-subscription-dialog';

@Component({
  selector: 'mh-subscriptions',
  imports: [
    DatePipe,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    MessageModule,
    CurrencyRonPipe,
    CreateSubscriptionDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscriptions implements OnInit {
  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly stripeOnboarded = signal(false);

  subscriptions = signal<Subscription[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  statusFilter = signal<SubscriptionStatus | undefined>(undefined);
  readonly statusOptions: { label: string; value: SubscriptionStatus | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Active', value: SubscriptionStatuses.Active },
    { label: 'Trialing', value: SubscriptionStatuses.Trialing },
    { label: 'Past due', value: SubscriptionStatuses.PastDue },
    { label: 'Canceled', value: SubscriptionStatuses.Canceled },
    { label: 'Paused', value: SubscriptionStatuses.Paused },
  ];

  showCreateDialog = signal(false);

  readonly Statuses = SubscriptionStatuses;

  ngOnInit(): void {
    this.loadOnboardingStatus();
    this.loadSubscriptions();
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

  loadSubscriptions(): void {
    this.loading.set(true);
    this._subscriptionService
      .list({
        status: this.statusFilter(),
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

  onStatusFilterChange(status: SubscriptionStatus | undefined): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadSubscriptions();
  }

  confirmCancel(sub: Subscription): void {
    this._confirmationService.confirm({
      message: 'Cancel this subscription at the end of the current billing period?',
      header: 'Cancel subscription',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.cancelSubscription(sub),
    });
  }

  confirmCancelImmediately(sub: Subscription): void {
    this._confirmationService.confirm({
      message: 'Cancel this subscription immediately? The client will lose access right away.',
      header: 'Cancel immediately',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.cancelSubscription(sub, true),
    });
  }

  private cancelSubscription(sub: Subscription, immediate = false): void {
    this._subscriptionService.cancel(sub.id, { immediate }).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: immediate ? 'Subscription canceled' : 'Subscription will cancel',
          detail: immediate
            ? 'Subscription has been canceled immediately'
            : 'Subscription will cancel at the end of the billing period',
        });
        this.loadSubscriptions();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to cancel subscription',
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
