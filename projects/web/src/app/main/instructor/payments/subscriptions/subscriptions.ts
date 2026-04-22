import {
  Component,
  ChangeDetectionStrategy,
  computed,
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
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import {
  SubscriptionService,
  SubscriptionStatuses,
  StripeOnboardingService,
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
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    MessageModule,
    CurrencyRonPipe,
    StatusLabelPipe,
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
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly stripeOnboarded = signal(false);

  subscriptions = signal<Subscription[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  loadingMore = signal(false);

  readonly rows = 10;
  currentPage = signal(1);

  /** Drives the mobile "Load more" button. Hidden once every server-side
   *  row is present in the accumulated list. */
  readonly hasMore = computed(
    () => this.subscriptions().length < this.totalRecords(),
  );

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

  /** Active subscription for the mobile action menu — tapping a
   *  card stashes its row here so the menu items can target the
   *  right subscription when invoked. Null when the menu is closed. */
  readonly actionMenuTarget = signal<Subscription | null>(null);

  /** Menu items derived from the active target. Empty list = no menu
   *  (e.g. already-canceled subscriptions aren't actionable). */
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

  /** Mobile "Load more": appends the next page to the current list. */
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

  /** Mobile card tap → opens the action menu anchored at the card.
   *  Must be called with a template reference to the `p-menu` so we
   *  can toggle it positionally. */
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

  /** Mobile card client line — falls back to a short id hash when the
   *  model only has a foreign key (Subscription doesn't embed client). */
  clientDisplay(sub: Subscription): string {
    if (!sub.clientId) return 'Unknown client';
    return `Client #${sub.clientId.slice(0, 8).toUpperCase()}`;
  }

  /** Mobile card subtitle — product label with the period-end hint. */
  planDisplay(sub: Subscription): string {
    const planId = sub.productId
      ? `Plan #${sub.productId.slice(0, 8).toUpperCase()}`
      : 'Plan';
    return planId;
  }

  /** Left-border accent to pull the eye to attention-worthy rows. */
  cardAccent(sub: Subscription): 'none' | 'primary' | 'danger' | 'success' {
    if (sub.status === SubscriptionStatuses.PastDue) return 'danger';
    if (sub.cancelAt) return 'danger';
    if (sub.status === SubscriptionStatuses.Trialing) return 'primary';
    if (sub.status === SubscriptionStatuses.Active) return 'success';
    return 'none';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
