import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
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
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ScrollCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
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
import { Logo } from '../../_shared/components/logo/logo';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { ClockService } from '../../_shared/services/clock.service';
import { avatarToneFor } from '../../_shared/utils/avatar-tone.utils';
import { CoachRow } from './_components/coach-row/coach-row';
import { DiscoverSessionRow } from './_components/discover-session-row/discover-session-row';
import { DiscoverFilterSheet } from './_sheets/discover-filter-sheet/discover-filter-sheet';
import { injectDiscoverSearch } from './discover-search';
import {
  DISCOVER_ICONS,
  DiscoverDatePresets,
  DiscoverSheetFilters,
  NO_SHEET_FILTERS,
  QUICK_FILTERS,
  QuickFilterId,
  coachName,
  compileDatePreset,
  quickFilterSelected,
} from './discover.config';
import { DiscoverCoachesStore } from './discover.store';

/**
 * Where the hero and its search field finish scrolling out — past this the
 * toolbar swaps to the compact bar that carries the search icon, so search
 * is never duplicated and never further than one tap.
 */
const SCROLL_COLLAPSE_PX = 120;

/**
 * Discover — the trainee's front door to the catalogue: brand hero, one
 * cross-type search, the "Taking new clients" coach rail, and the session
 * feed in chronological buckets. A coach lands here too (via More), so the
 * page carries no role branches.
 *
 * Search is a header takeover (the Messages pattern) and is fully isolated
 * from the browse feed — Cancel restores the exact list and chips without
 * a refetch.
 */
@Component({
  selector: 'mh-discover',
  imports: [
    AvatarButton,
    CoachRow,
    DiscoverFilterSheet,
    DiscoverSessionRow,
    EmptyState,
    HexAvatar,
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
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    Logo,
    NotificationBell,
    SessionRowSkeleton,
  ],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
  providers: [SessionsDiscoverStore, DiscoverCoachesStore],
})
export class Discover implements ViewWillEnter {
  readonly sessionsStore = inject(SessionsDiscoverStore);
  readonly coachesStore = inject(DiscoverCoachesStore);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);
  private readonly _clockService = inject(ClockService);
  private readonly _router = inject(Router);

  readonly search = injectDiscoverSearch();

  readonly quickFilters = QUICK_FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly railSkeleton = [1, 2, 3, 4];

  readonly searchOpen = signal(false);
  readonly scrolled = signal(false);
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

  // ─── Rail ─────────────────────────────────────────────────────────────────

  railName(coach: InstructorSearchResult): string {
    return coachName(coach);
  }

  railTone(coach: InstructorSearchResult): string {
    return avatarToneFor(coach.userId);
  }

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

  // ─── Chrome ───────────────────────────────────────────────────────────────

  onScroll(event: ScrollCustomEvent): void {
    this.scrolled.set(event.detail.scrollTop > SCROLL_COLLAPSE_PX);
  }

  // ─── Loading / navigation ─────────────────────────────────────────────────

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this._myBookingsIndexStore.ensureLoaded(true);
    this.coachesStore.load({ force: true });
    // The spinner hangs on the feed — the rail settles on its own.
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

  openAllCoaches(): void {
    void this._router.navigate(['/tabs/discover/coaches']);
  }
}
