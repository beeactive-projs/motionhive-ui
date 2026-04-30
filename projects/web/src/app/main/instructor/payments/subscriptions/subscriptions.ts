import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
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
  showApiError,
  type Subscription,
  type SubscriptionStatus,
} from 'core';
import { catchError, of, startWith, Subject, switchMap, take } from 'rxjs';
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
export class Subscriptions {
  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _scrollSentinel = viewChild<ElementRef>('scrollSentinel');
  private _observer?: IntersectionObserver;

  private readonly _reload$ = new Subject<void>();

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
    // Awaiting client confirmation — shown so instructors can find
    // subscriptions where the client hasn't yet confirmed and paid the
    // first invoice.
    { label: 'Awaiting confirmation', value: SubscriptionStatuses.Incomplete },
    { label: 'Past due', value: SubscriptionStatuses.PastDue },
    { label: 'Canceled', value: SubscriptionStatuses.Canceled },
    { label: 'Paused', value: SubscriptionStatuses.Paused },
  ];

  readonly showCreateDialog = signal(false);
  readonly actionMenuTarget = signal<Subscription | null>(null);

  readonly actionMenuItems = computed<MenuItem[]>(() => {
    const sub = this.actionMenuTarget();
    if (!sub) return [];
    const items: MenuItem[] = [
      {
        label: 'View details',
        icon: 'pi pi-arrow-right',
        command: () => this.openDetail(sub),
      },
    ];
    if (
      sub.status === SubscriptionStatuses.Active ||
      sub.status === SubscriptionStatuses.Trialing
    ) {
      items.push({ separator: true });
      if (!sub.cancelAt) {
        items.push({
          label: 'Cancel at period end',
          icon: 'pi pi-times',
          command: () => this.confirmCancel(sub),
        });
      }
      items.push({
        label: 'Cancel immediately',
        icon: 'pi pi-trash',
        styleClass: 'text-red-500',
        command: () => this.confirmCancelImmediately(sub),
      });
    }
    return items;
  });

  readonly Statuses = SubscriptionStatuses;

  constructor() {
    this._reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          return this._subscriptionService
            .list({
              status: this.statusFilter(),
              page: this.currentPage(),
              limit: this.rows,
            })
            .pipe(
              catchError((err) => {
                showApiError(this._messageService, 'Error', 'Failed to load memberships', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        if (response) {
          this.subscriptions.set(response.items);
          this.totalRecords.set(response.total);
        }
        this.loading.set(false);
        this.loadingMore.set(false);
      });

    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  reload(): void {
    this._reload$.next();
  }

  /** Navigate to the membership detail page. Triggered by row click. */
  openDetail(sub: Subscription): void {
    this._router.navigate(['/coaching/subscriptions', sub.id]);
  }

  /**
   * Plan name only — for the truncated first row of the Plan cell.
   * Falls back to a short product-id stub if the join didn't return a
   * product (legacy rows from before the snapshot was added).
   */
  planName(sub: Subscription): string {
    if (sub.product?.name) return sub.product.name;
    return sub.productId
      ? `Plan #${sub.productId.slice(0, 8).toUpperCase()}`
      : 'Plan';
  }

  /** Cadence subtitle for the Plan cell, e.g. "every 2 months" or "monthly". */
  planCycle(sub: Subscription): string | null {
    const p = sub.product;
    if (!p?.interval) return null;
    return p.intervalCount && p.intervalCount > 1
      ? `every ${p.intervalCount} ${p.interval}s`
      : `${p.interval}ly`;
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.reload();
  }

  onStatusFilterChange(status: SubscriptionStatus | undefined): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.reload();
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
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.subscriptions.update((list) => [...list, ...response.items]);
          this.totalRecords.set(response.total);
          this.currentPage.update((p) => p + 1);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loadingMore.set(false);
          showApiError(this._messageService, 'Error', 'Failed to load more memberships', err);
        },
      });
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
    this._subscriptionService
      .cancel(sub.id, { immediate })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: immediate ? 'Subscription canceled' : 'Subscription will cancel',
            detail: immediate
              ? 'Subscription has been canceled immediately'
              : 'Subscription will cancel at the end of the billing period',
          });
          this.reload();
        },
        error: (err) => {
          showApiError(this._messageService, 'Error', 'Failed to cancel subscription', err);
        },
      });
  }

  readonly statusSeverity = getSubscriptionStatusSeverity;

  /**
   * Friendly client label: "First Last" if names are present, else
   * the email, else the legacy ID-prefix fallback for old rows that
   * predate the eager-load enrichment.
   */
  clientDisplay(sub: Subscription): string {
    const c = sub.client;
    if (c) {
      const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
      return fullName || c.email;
    }
    if (!sub.clientId) return 'Unknown client';
    return `Client #${sub.clientId.slice(0, 8).toUpperCase()}`;
  }

  clientEmail(sub: Subscription): string | null {
    return sub.client?.email ?? null;
  }

  clientInitials(sub: Subscription): string {
    const c = sub.client;
    if (c?.firstName && c?.lastName) {
      return (c.firstName.charAt(0) + c.lastName.charAt(0)).toUpperCase();
    }
    if (c?.email) return c.email.charAt(0).toUpperCase();
    return '?';
  }

  /**
   * Friendly plan label: the product name, with a small billing
   * cadence suffix (e.g. "Premium · monthly"). Falls back to the
   * legacy ID-prefix when the row pre-dates the join.
   */
  planDisplay(sub: Subscription): string {
    const p = sub.product;
    if (p?.name) {
      const cadence = p.interval
        ? p.intervalCount && p.intervalCount > 1
          ? ` · every ${p.intervalCount} ${p.interval}s`
          : ` · ${p.interval}ly`
        : '';
      return `${p.name}${cadence}`;
    }
    return sub.productId
      ? `Plan #${sub.productId.slice(0, 8).toUpperCase()}`
      : 'Plan';
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
