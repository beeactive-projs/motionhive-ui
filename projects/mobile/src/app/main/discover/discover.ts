import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  InstructorSearchResult,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionGroup,
  SessionsDiscoverStore,
  groupSessionsByBucket,
} from 'core';

import { AvatarButton } from '../../_shared/components/avatar-button/avatar-button';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { SearchbarAutofocusDirective } from '../../_shared/directives/searchbar-autofocus.directive';
import { ClockService } from '../../_shared/services/clock.service';
import { CoachRow } from './_components/coach-row/coach-row';
import { DiscoverSessionRow } from './_components/discover-session-row/discover-session-row';
import { DiscoverStrip } from './_components/discover-strip/discover-strip';
import { DiscoverGroupRow } from './_components/group-row/group-row';
import { DiscoverFilterSheet } from './_sheets/discover-filter-sheet/discover-filter-sheet';
import { injectDiscoverSearch } from './discover-search';
import {
  DISCOVER_ICONS,
  DiscoverDatePresets,
  DiscoverSheetFilters,
  NO_SHEET_FILTERS,
  QUICK_FILTERS,
  QuickFilterId,
  coachStripItem,
  compileDatePreset,
  groupStripItem,
  quickFilterSelected,
} from './discover.config';
import { DiscoverCoachesStore, DiscoverGroupsStore } from './discover.store';

/**
 * Discover, a tab in both modes: the hero, one cross-type search, the
 * coaches taking clients, the groups to join, and the sessions coming up in
 * chronological buckets. Coach and trainee see the same page, so it carries
 * no role branches.
 *
 * Search is a header takeover (the Messages pattern) and is fully isolated
 * from the browse feed: Cancel restores the exact list and chips without
 * a refetch.
 */
@Component({
  selector: 'mh-discover',
  imports: [
    AvatarButton,
    CoachRow,
    DiscoverFilterSheet,
    DiscoverGroupRow,
    DiscoverSessionRow,
    DiscoverStrip,
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    RowSkeleton,
    SearchbarAutofocusDirective,
    SessionRowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
  providers: [SessionsDiscoverStore, DiscoverCoachesStore, DiscoverGroupsStore],
})
export class Discover implements ViewWillEnter {
  readonly sessionsStore = inject(SessionsDiscoverStore);
  readonly coachesStore = inject(DiscoverCoachesStore);
  readonly groupsStore = inject(DiscoverGroupsStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);
  private readonly _clockService = inject(ClockService);
  private readonly _router = inject(Router);

  readonly search = injectDiscoverSearch();

  readonly quickFilters = QUICK_FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly searchOpen = signal(false);
  readonly filterSheetOpen = signal(false);
  /** What the sheet last applied — kept so reopening it shows reality. */
  readonly sheetFilters = signal<DiscoverSheetFilters>(NO_SHEET_FILTERS);

  constructor() {
    addIcons(DISCOVER_ICONS);
  }

  ionViewWillEnter(): void {
    this._clockService.bump();
    this._myBookingsIndexStore.ensureLoaded();
    this.coachesStore.load();
    this.groupsStore.load();
    // Filters survive re-entry; stale rows refresh in place (no blank flash).
    this.sessionsStore.reload();
  }

  // ─── Feed ─────────────────────────────────────────────────────────────────

  readonly days = computed<SessionGroup<PublicSessionInstance>[]>(() =>
    groupSessionsByBucket(this.sessionsStore.items(), (i) => i.startAt, 'future'),
  );

  readonly showSkeleton = computed(
    () => this.sessionsStore.loading() && this.sessionsStore.items().length === 0,
  );

  readonly showLoadError = computed(
    () => !!this.sessionsStore.error() && this.sessionsStore.items().length === 0,
  );

  readonly isEmpty = computed(
    () =>
      !this.sessionsStore.loading() &&
      !this.sessionsStore.error() &&
      this.sessionsStore.items().length === 0,
  );

  readonly hasActiveFilters = computed(() => {
    const filters = this.sessionsStore.filters();
    return !!(filters.type || filters.locationKind || filters.dateFrom || filters.dateTo);
  });

  readonly datesActive = computed(
    () => this.sheetFilters().datePreset !== DiscoverDatePresets.Any,
  );

  isQuickSelected(id: QuickFilterId): boolean {
    return quickFilterSelected(this.sessionsStore.filters(), id);
  }

  onQuickFilter(id: QuickFilterId): void {
    const chip = this.quickFilters.find((c) => c.id === id);
    if (!chip) return;
    // Keep the sheet's draft source in step so reopening it shows reality.
    this.sheetFilters.update((filters) => ({
      ...filters,
      type: chip.patch.type ?? null,
      locationKind: chip.patch.locationKind ?? null,
    }));
    this.sessionsStore.setFilters(chip.patch);
  }

  openFilters(): void {
    this.filterSheetOpen.set(true);
  }

  onFiltersApplied(filters: DiscoverSheetFilters): void {
    this.sheetFilters.set(filters);
    const window = compileDatePreset(filters.datePreset, new Date());
    this.sessionsStore.setFilters({
      type: filters.type ?? undefined,
      locationKind: filters.locationKind ?? undefined,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });
  }

  clearFilters(): void {
    this.sheetFilters.set({ ...NO_SHEET_FILTERS });
    this.sessionsStore.setFilters({
      type: undefined,
      locationKind: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  }

  isBooked(instance: PublicSessionInstance): boolean {
    return this._myBookingsIndexStore.hasBooking(instance.id);
  }

  isToday(day: SessionGroup<PublicSessionInstance>): boolean {
    return day.bucket.key === 'today';
  }

  retry(): void {
    this.sessionsStore.reload();
  }

  // ─── Strips ───────────────────────────────────────────────────────────────

  /** A coach browsing is not pitched to themselves: their own profile stays
      in the full list and in search, not in this strip. */
  readonly coachItems = computed(() => {
    const me = this._authStore.user()?.id;
    return this.coachesStore
      .acceptingCoaches()
      .filter((coach) => coach.userId !== me)
      .map(coachStripItem);
  });

  readonly groupItems = computed(() => this.groupsStore.groups().map(groupStripItem));

  // ─── Search takeover ──────────────────────────────────────────────────────

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.search.clear();
  }

  onQueryChange(value: string): void {
    this.search.setQuery(value);
  }

  clearSearch(): void {
    this.search.clear();
  }

  /** Whether an earlier answer is on screen, so a new keystroke keeps it up
      instead of flashing placeholders. */
  readonly hasSearchHits = computed(
    () =>
      this.search.coaches().length + this.search.groups().length + this.search.sessions().length >
      0,
  );

  // ─── Loading / navigation ─────────────────────────────────────────────────

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this._myBookingsIndexStore.ensureLoaded(true);
    this.coachesStore.load({ force: true });
    this.groupsStore.load({ force: true });
    // The spinner hangs on the feed — the rails settle on their own.
    this.sessionsStore.reload(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.sessionsStore.loadMore(() => void event.target.complete());
  }

  openSession(instance: PublicSessionInstance): void {
    void this._router.navigate(['/tabs/discover', instance.id]);
  }

  openCoach(coach: InstructorSearchResult): void {
    if (coach.handle) void this._router.navigate(['/tabs/discover/person', coach.handle]);
  }

  openCoachById(id: string): void {
    const coach = this.coachesStore.coaches().find((c) => c.id === id);
    if (coach) this.openCoach(coach);
  }

  openAllCoaches(): void {
    void this._router.navigate(['/tabs/discover/coaches']);
  }

  /** A group seen from outside, pushed onto this stack so back returns here. */
  openGroup(groupId: string): void {
    void this._router.navigate(['/tabs/discover/group', groupId]);
  }

  /** The full list, in this stack too, so back comes here and not to the
      Menu the Groups page sits under. */
  openAllGroups(): void {
    void this._router.navigate(['/tabs/discover/groups']);
  }
}
