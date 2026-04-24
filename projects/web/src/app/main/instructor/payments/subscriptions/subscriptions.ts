import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { DataView } from 'primeng/dataview';
import { Menu } from 'primeng/menu';
import {
  SubscriptionService,
  SubscriptionStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getSubscriptionStatusSeverity,
  type Subscription,
  type SubscriptionStatus,
} from 'core';
import { CreateSubscriptionDialog } from '../../_dialogs/create-subscription-dialog/create-subscription-dialog';
import { ListCard } from '../../../../_shared/components/list-card/list-card';

@Component({
  selector: 'mh-subscriptions',
  imports: [
    DatePipe,
    Button,
    TableModule,
    Tag,
    SkeletonModule,
    ToastModule,
    ConfirmDialog,
    Tooltip,
    CurrencyRonPipe,
    StatusLabelPipe,
    DataView,
    CreateSubscriptionDialog,
    ListCard,
    Menu,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscriptions implements OnInit {
  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly subscriptions = signal<Subscription[]>([]);
  readonly totalRecords = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);

  readonly rows = 10;
  readonly currentPage = signal(1);

  readonly hasMore = computed(() => this.subscriptions().length < this.totalRecords());

  readonly statusFilter = signal<SubscriptionStatus | undefined>(undefined);
  readonly statusOptions: { label: string; value: SubscriptionStatus | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Active', value: SubscriptionStatuses.Active },
    { label: 'Trialing', value: SubscriptionStatuses.Trialing },
    { label: 'Past due', value: SubscriptionStatuses.PastDue },
    { label: 'Canceled', value: SubscriptionStatuses.Canceled },
    { label: 'Paused', value: SubscriptionStatuses.Paused },
  ];

  readonly showCreateDialog = signal(false);
  readonly actionMenuTarget = signal<Subscription | null>(null);

  readonly actionMenuItems = computed<MenuItem[]>(() => {
    const sub = this.actionMenuTarget();
    if (!sub) return [];
    if (
      sub.status !== SubscriptionStatuses.Active &&
      sub.status !== SubscriptionStatuses.Trialing
    ) {
      return [];
    }
    return [
      {
        label: 'Cancel at period end',
        icon: 'pi pi-times',
        command: () => this.confirmCancel(sub),
      },
      {
        label: 'Cancel immediately',
        icon: 'pi pi-trash',
        styleClass: 'text-red-500',
        command: () => this.confirmCancelImmediately(sub),
      },
    ];
  });

  readonly Statuses = SubscriptionStatuses;

  ngOnInit(): void {
    this.loadSubscriptions();
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
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subscriptions',
          });
        },
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this._subscriptionService
      .list({
        status: this.statusFilter(),
        page: this.currentPage() + 1,
        limit: this.rows,
      })
      .subscribe({
        next: (response) => {
          this.subscriptions.update((list) => [...list, ...response.items]);
          this.totalRecords.set(response.total);
          this.currentPage.update((p) => p + 1);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load more memberships',
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

  openActionMenu(sub: Subscription, event: MouseEvent, menu: Menu): void {
    this.actionMenuTarget.set(sub);
    menu.toggle(event);
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

  readonly statusSeverity = getSubscriptionStatusSeverity;

  clientDisplay(sub: Subscription): string {
    if (!sub.clientId) return 'Unknown client';
    return `Client #${sub.clientId.slice(0, 8).toUpperCase()}`;
  }

  planDisplay(sub: Subscription): string {
    return sub.productId ? `Plan #${sub.productId.slice(0, 8).toUpperCase()}` : 'Plan';
  }

  cardAccent(sub: Subscription): 'none' | 'primary' | 'danger' | 'success' {
    if (sub.status === SubscriptionStatuses.PastDue) return 'danger';
    if (sub.cancelAt) return 'danger';
    if (sub.status === SubscriptionStatuses.Trialing) return 'primary';
    if (sub.status === SubscriptionStatuses.Active) return 'success';
    return 'none';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
