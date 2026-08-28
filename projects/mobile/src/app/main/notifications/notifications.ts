import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { BellNotification, NotificationStore, dayDividerLabel, localDayKey } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { queryParamsFor, routeFor } from '../../_shared/config/notification-deep-link';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { NotificationRow } from './_components/notification-row/notification-row';
import { NotificationsEmpty } from './_components/notifications-empty/notifications-empty';
import { NotificationDetailSheet } from './_sheets/notification-detail-sheet/notification-detail-sheet';
import { NotificationFilterSheet } from './_sheets/notification-filter-sheet/notification-filter-sheet';
import {
  NO_FILTERS,
  NOTIFICATION_ICONS,
  NotificationFilters,
  activeFilterCount,
  categoryListLabel,
  sameFilters,
} from './notifications.config';

/** One day's worth of rows, as the template consumes them. */
interface NotificationDay {
  key: string;
  label: string;
  items: BellNotification[];
}

/**
 * The notification centre.
 *
 * Flat and chronological, newest first, one card per day under a date pill.
 * Grouping by category was considered and dropped: the category filter already
 * answers "show me only payments" without reordering time, and a feed that
 * reorders itself is a feed you cannot scan.
 *
 * Opening the list marks its rows *viewed* (an analytics signal) but never
 * *read*. Unread clears three ways only, all of them deliberate: tapping a
 * row, swiping it, or Mark all read.
 */
@Component({
  selector: 'mh-notifications',
  imports: [
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationDetailSheet,
    NotificationFilterSheet,
    NotificationRow,
    NotificationsEmpty,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements ViewWillEnter {
  readonly store = inject(NotificationStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7];

  /** The row the detail sheet is showing, and therefore whether it is open. */
  readonly detail = signal<BellNotification | null>(null);
  readonly detailOpen = signal(false);

  /** The filter sheet, opened from the Filters button. */
  readonly filterOpen = signal(false);

  /** What the list is narrowed to, as the sheet edits it. The store owns it. */
  readonly filters = computed<NotificationFilters>(() => ({
    unreadOnly: this.store.unreadOnly(),
    categories: this.store.categories(),
  }));
  readonly filterCount = computed(() => activeFilterCount(this.filters()));
  readonly hasFilter = computed(() => this.filterCount() > 0);

  /** "Sessions and Payments" — null with no category on. */
  readonly categoryLabel = computed(() => categoryListLabel(this.store.categories()));

  /**
   * Rows bucketed by local calendar day. Dropped while a category filter is
   * on — three payment alerts spread over a month make more dividers than
   * rows, and each row already carries its own date in that mode.
   */
  readonly days = computed<NotificationDay[]>(() => {
    if (this.store.categories().length > 0) return [];

    const buckets = new Map<string, BellNotification[]>();
    for (const item of this.store.notifications()) {
      const key = localDayKey(new Date(item.createdAt));
      const bucket = buckets.get(key);
      if (bucket) bucket.push(item);
      else buckets.set(key, [item]);
    }

    // Insertion order is the server's order, which is already newest-first.
    return [...buckets].map(([key, items]) => ({
      key,
      label: dayDividerLabel(key),
      items,
    }));
  });

  /** "3 of 3 in Payments" — the filtered list says how much of it you see. */
  readonly filterSummary = computed(() => {
    const label = this.categoryLabel();
    if (!label || !this.store.hasLoadedList()) return null;
    return `${this.store.notifications().length} of ${this.store.total()} in ${label}`;
  });

  /** First load only. A refresh happens under the rows already on screen. */
  readonly showSkeleton = computed(() => this.store.loading() && !this.store.hasLoadedList());

  readonly showLoadError = computed(() => this.store.loadFailed() && !this.store.hasLoadedList());

  readonly isEmpty = computed(
    () => this.store.hasLoadedList() && this.store.notifications().length === 0,
  );

  constructor() {
    addIcons(NOTIFICATION_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page in its tab stack, so that would run
  // once per app session and the list would age while the badge moved.
  ionViewWillEnter(): void {
    const requested = this._route.snapshot.queryParamMap.get('open');
    this.store.loadList({
      markViewedAfter: true,
      // The arrival banner hands off here rather than deciding for itself
      // where a notification leads.
      done: requested ? () => this._openById(requested) : undefined,
    });
  }

  // ─── Filters ──────────────────────────────────────────────────

  openFilters(): void {
    this.filterOpen.set(true);
  }

  onFiltersApplied(filters: NotificationFilters): void {
    if (sameFilters(filters, this.filters())) return;
    this.store.loadList({ ...filters, markViewedAfter: true });
  }

  /** The quick chips in the strip write straight through to the sheet's Status. */
  setUnreadOnly(unreadOnly: boolean): void {
    this.onFiltersApplied({ ...this.filters(), unreadOnly });
  }

  clearFilters(): void {
    this.onFiltersApplied({ ...NO_FILTERS });
  }

  /** The line under a filtered list drops the categories and keeps Status. */
  clearCategories(): void {
    this.onFiltersApplied({ ...this.filters(), categories: [] });
  }

  // ─── Rows ─────────────────────────────────────────────────────

  /**
   * A tap always marks read. Where it goes next depends on whether the
   * notification points at a screen this app has: if it does, follow it; if
   * it does not, open the detail sheet so the row still resolves into
   * something rather than doing nothing.
   */
  open(item: BellNotification): void {
    this.store.markClicked(item.id);

    const commands = routeFor(item.data);
    if (!commands) {
      // The row the template handed over is the pre-click copy, so the sheet
      // would offer "Mark read" on something the tap just read.
      this.detail.set(this._current(item.id) ?? item);
      this.detailOpen.set(true);
      return;
    }

    const queryParams = queryParamsFor(item.data);
    void this._router.navigate(commands, queryParams ? { queryParams } : {});
  }

  toggleRead(item: BellNotification): void {
    if (item.readAt) this.store.markUnread(item.id);
    else this.store.markRead(item.id);
  }

  dismiss(item: BellNotification): void {
    this.store.dismiss(item.id);
  }

  remove(item: BellNotification): void {
    this.store.remove(item.id);
    void this._feedbackService.success('Deleted');
  }

  markAllRead(): void {
    this.store.markAllRead();
    // Under the Unread filter every row this just touched no longer belongs
    // there. Dropping back to All keeps the list honest without the rows
    // vanishing out from under the tap.
    if (this.store.unreadOnly()) this.store.loadList({ unreadOnly: false });
  }

  // ─── Detail sheet ─────────────────────────────────────────────

  toggleReadFromDetail(): void {
    const item = this.detail();
    if (!item) return;
    this.toggleRead(item);
    // The sheet reads from the list, so re-point it at the updated row.
    this.detail.set(this._current(item.id));
  }

  removeFromDetail(): void {
    const item = this.detail();
    if (!item) return;
    this.detailOpen.set(false);
    this.remove(item);
  }

  /**
   * Open a row the user tapped somewhere else — the arrival banner. Silently
   * does nothing if it is no longer on the first page (dismissed, deleted, or
   * pushed off by a burst); the list is right there either way.
   */
  private _openById(receiptId: string): void {
    // Drop the param so a back-navigation or a tab return does not reopen it.
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: {},
      replaceUrl: true,
    });

    const item = this._current(receiptId);
    if (item) this.open(item);
  }

  /** The store's copy of a row — the one that carries the latest read state. */
  private _current(receiptId: string): BellNotification | null {
    return this.store.notifications().find((n) => n.id === receiptId) ?? null;
  }

  // ─── Page chrome ──────────────────────────────────────────────

  /** The empty state's one button: clear the filter that emptied it, or settings. */
  onEmptyAction(): void {
    if (this.hasFilter()) this.clearFilters();
    else this.openSettings();
  }

  openSettings(): void {
    void this._router.navigate(['/tabs/home/account/notifications']);
  }

  retry(): void {
    this.store.loadList({ markViewedAfter: true });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refreshUnreadCount();
    this.store.loadList({ markViewedAfter: true, done: () => void event.target.complete() });
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore({ done: () => void event.target.complete() });
  }
}
