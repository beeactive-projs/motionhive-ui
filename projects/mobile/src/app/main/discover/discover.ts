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
  CategoryStore,
  InstructorSearchResult,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionGroup,
  SessionsDiscoverStore,
  groupSessionsByBucket,
  translate,
} from 'core';

import { AvatarButton } from '../../_shared/components/avatar-button/avatar-button';
import { ChoiceOption, ChoiceSheet } from '../../_shared/components/choice-sheet/choice-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { DISCOVER_HEX_SHAPE, cornerPrintPath } from '../../_shared/config/hexagon.config';
import { ClockService } from '../../_shared/services/clock.service';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { COACHES_URL } from '../coaches/coaches.filters';
import { CoachRow } from './_components/coach-row/coach-row';
import { DiscoverSessionRow } from './_components/discover-session-row/discover-session-row';
import { FeaturedCoach } from './_components/featured-coach/featured-coach';
import { GroupCard } from './_components/group-card/group-card';
import { DiscoverFilterSheet } from './_sheets/discover-filter-sheet/discover-filter-sheet';
import {
  DISCOVER_ICONS,
  DiscoverSheetFilters,
  DiscoverTopic,
  DiscoverTopicIds,
  EVERYWHERE,
  NO_SHEET_FILTERS,
  QUICK_FILTERS,
  QuickFilterId,
  coachMatchesTopic,
  coachNearLine,
  coachOfTheWeek,
  compileDatePreset,
  discoverCities,
  discoverLinks,
  discoverTopicChips,
  groupMatchesTopic,
  inCity,
  quickFilterSelected,
  resolveCity,
  sessionInCity,
  sessionMatchesTopic,
  sheetBeyondQuickChips,
  sheetFilterCount,
  sortCoaches,
  withoutReader,
} from './discover.config';
import { OnboardingStateService } from '../../_shared/services/onboarding-state.service';
import { DiscoverPrefs } from './discover-prefs';
import { DiscoverCoachesStore, DiscoverGroupsStore } from './discover.store';

/** Rows under "Coaches near you" before "All" takes over. */
const NEAR_LIMIT = 3;

/** Group cards, two to a row, before "All" takes over. */
const GROUP_CARD_LIMIT = 4;

/**
 * The corner print's box and cells, in px at the default text size, as the
 * design drew them: 170 × 120, cells 22 from the centre to a point. The svg
 * is sized in rem, so it grows with the phone's text size like the rest.
 */
const PRINT_WIDTH = 170;
const PRINT_HEIGHT = 120;
const PRINT_RADIUS = 22;

/**
 * Discover, a tab in both modes, after the canvas design "Discover Header
 * Clean", A, as drawn (owner, 2026-11-07): a white header whose only brand
 * mark is the corner print, with the city, the way into search and the
 * topic chips under a hairline; then the coach of the week, the coaches
 * near you, the groups to join and the sessions coming up, with pointy
 * avatars. The city and the topic filter every section. Coach and trainee
 * see the same page, so it carries no role branches, and never shows the
 * reader to themselves.
 *
 * Search is its own screen (`search/discover-search-page.ts`), pushed from
 * the band's field so back returns here.
 */
@Component({
  selector: 'mh-discover',
  imports: [
    AvatarButton,
    ChoiceSheet,
    CoachRow,
    DiscoverFilterSheet,
    DiscoverSessionRow,
    EmptyState,
    FeaturedCoach,
    GroupCard,
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
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    RowSkeleton,
    SessionRowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
  host: { class: 'mh-whole-words' },
  providers: [SessionsDiscoverStore, DiscoverCoachesStore, DiscoverGroupsStore],
})
export class Discover implements ViewWillEnter {
  readonly sessionsStore = inject(SessionsDiscoverStore);
  readonly coachesStore = inject(DiscoverCoachesStore);
  readonly groupsStore = inject(DiscoverGroupsStore);
  private readonly _prefs = inject(DiscoverPrefs);
  private readonly _authStore = inject(AuthStore);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);
  private readonly _clockService = inject(ClockService);
  private readonly _router = inject(Router);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _categoryStore = inject(CategoryStore);
  private readonly _onboarding = inject(OnboardingStateService);

  /** This page lives only in Discover's own stack. */
  private readonly _links = discoverLinks('/tabs/discover');

  readonly print = {
    viewBox: `0 0 ${PRINT_WIDTH} ${PRINT_HEIGHT}`,
    d: cornerPrintPath(PRINT_WIDTH, PRINT_HEIGHT, PRINT_RADIUS),
  };
  /** Discover's avatars stand on a point, as its design draws them. */
  readonly hexShape = DISCOVER_HEX_SHAPE;
  readonly quickFilters = QUICK_FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  /**
   * The chip the reader picked: an id, null for none, undefined until they
   * pick (then For you is lit when there is one, see `selectedTopic`).
   */
  private readonly _pickedTopicId = signal<string | null | undefined>(undefined);
  readonly citySheetOpen = signal(false);
  readonly filterSheetOpen = signal(false);
  /** What the sheet last applied — kept so reopening it shows reality. */
  readonly sheetFilters = signal<DiscoverSheetFilters>(NO_SHEET_FILTERS);

  constructor() {
    addIcons(DISCOVER_ICONS);
  }

  ionViewWillEnter(): void {
    this._clockService.bump();
    this._myBookingsIndexStore.ensureLoaded();
    this._prefs.ensureAccountCity();
    this._categoryStore.ensureLoaded();
    void this._onboarding.ensureLoaded();
    this.coachesStore.load();
    this.groupsStore.load();
    // Filters survive re-entry; stale rows refresh in place (no blank flash).
    this.sessionsStore.reload();
  }

  // ─── What the reader may see ────────────────────────────────────────────

  private readonly _readerId = computed(() => this._authStore.user()?.id ?? null);

  private readonly _coaches = computed(() =>
    withoutReader(this.coachesStore.coaches(), this._readerId()),
  );

  /** Their own sessions are not pitched to a coach either. */
  private readonly _sessions = computed(() => {
    const me = this._readerId();
    return this.sessionsStore.items().filter((instance) => instance.instructorId !== me);
  });

  // ─── City ───────────────────────────────────────────────────────────────

  private readonly _cities = computed(() =>
    discoverCities(this._coaches(), this.groupsStore.groups(), this._sessions()),
  );

  readonly city = computed(() =>
    resolveCity(this._prefs.chosenCity(), this._prefs.accountCity(), this._cities()),
  );

  private readonly _cityKey = computed(() => this.city()?.key ?? null);

  /**
   * The pill waits until it can say the right city: the account's city and
   * the first answer of each list decide it, and naming one city then
   * another would read as the tab changing its mind.
   */
  readonly cityReady = computed(
    () =>
      this._prefs.accountCityLoaded() &&
      (this.coachesStore.loaded() || this.coachesStore.error()) &&
      (this.groupsStore.loaded() || this.groupsStore.error()) &&
      !(this.sessionsStore.loading() && this.sessionsStore.items().length === 0),
  );

  readonly cityLabel = computed(() => this.city()?.label ?? translate('discover.city.everywhere'));

  readonly cityOptions = computed<ChoiceOption[]>(() => [
    { value: EVERYWHERE, label: translate('discover.city.everywhere') },
    ...this._cities().map((city) => ({ value: city.key, label: city.label })),
  ]);

  readonly citySelected = computed(() => this.city()?.key ?? EVERYWHERE);

  openCity(): void {
    this.citySheetOpen.set(true);
  }

  onCityPicked(value: string): void {
    this._prefs.setCity(value);
  }

  // ─── Topic ──────────────────────────────────────────────────────────────

  /**
   * The chips, over what the city shows: For you (the reader's interests),
   * the activities with something here, then Online.
   */
  readonly topics = computed<DiscoverTopic[]>(() => {
    const key = this._cityKey();
    return discoverTopicChips(this._categoryStore.categories(), this._onboarding.interestIds(), {
      coaches: this._coaches().filter((coach) => inCity(coach.city, key)),
      groups: this.groupsStore.groups().filter((group) => inCity(group.city, key)),
      sessions: this._sessions().filter((instance) => sessionInCity(instance, key)),
    });
  });

  /** What narrows the tab: the reader's pick, else For you while it is on offer. */
  readonly selectedTopic = computed<DiscoverTopic | null>(() => {
    const picked = this._pickedTopicId();
    const topics = this.topics();
    if (picked === undefined) {
      return topics.find((topic) => topic.id === DiscoverTopicIds.ForYou) ?? null;
    }
    if (picked === null) {
      return null;
    }
    return topics.find((topic) => topic.id === picked) ?? null;
  });

  /** One topic at a time; tapping the lit one turns it off. */
  toggleTopic(id: string): void {
    if (this.selectedTopic()?.id === id) {
      this._pickedTopicId.set(null);
    } else {
      this._pickedTopicId.set(id);
    }
  }

  // ─── Coaches ────────────────────────────────────────────────────────────

  readonly coachesLoading = computed(
    () => this.coachesStore.loading() && !this.coachesStore.loaded(),
  );

  /** Picked from every coach, the reader included, so the week's pick is the
      same whoever looks; the reader is then passed over. */
  readonly featured = computed(() =>
    coachOfTheWeek(this.coachesStore.coaches(), {
      cityKey: this._cityKey(),
      readerId: this._readerId(),
      topic: this.selectedTopic(),
      now: new Date(this._clockService.now()),
    }),
  );

  readonly featuredKicker = computed(() => {
    const city = this.featured()?.city?.trim();
    return city
      ? translate('discover.featured.kickerCity', { city })
      : translate('discover.featured.kicker');
  });

  readonly nearCoaches = computed(() => {
    const featuredId = this.featured()?.id;
    const key = this._cityKey();
    const topic = this.selectedTopic();
    return sortCoaches(
      this._coaches().filter(
        (coach) =>
          coach.id !== featuredId && inCity(coach.city, key) && coachMatchesTopic(coach, topic),
      ),
    ).slice(0, NEAR_LIMIT);
  });

  readonly nearTitle = computed(() =>
    this._cityKey() ? 'discover.coaches.near' : 'discover.coaches.title',
  );

  /** What "All" opens: every coach but the reader. */
  readonly allCoachesCount = computed(() => this._coaches().length);

  nearLine(coach: InstructorSearchResult): string {
    return coachNearLine(coach, !this._cityKey());
  }

  // ─── Groups ─────────────────────────────────────────────────────────────

  readonly groupsLoading = computed(
    () => this.groupsStore.loading() && !this.groupsStore.loaded(),
  );

  readonly groupCards = computed(() => {
    const key = this._cityKey();
    const topic = this.selectedTopic();
    return this.groupsStore
      .groups()
      .filter((group) => inCity(group.city, key) && groupMatchesTopic(group, topic))
      .slice(0, GROUP_CARD_LIMIT);
  });

  // ─── Coming up ──────────────────────────────────────────────────────────

  private readonly _agenda = computed(() => {
    const key = this._cityKey();
    const topic = this.selectedTopic();
    return this._sessions().filter(
      (instance) => sessionInCity(instance, key) && sessionMatchesTopic(instance, topic),
    );
  });

  readonly days = computed<SessionGroup<PublicSessionInstance>[]>(() =>
    groupSessionsByBucket(this._agenda(), (i) => i.startAt, 'future'),
  );

  readonly showSkeleton = computed(
    () => this.sessionsStore.loading() && this.sessionsStore.items().length === 0,
  );

  readonly showLoadError = computed(
    () => !!this.sessionsStore.error() && this.sessionsStore.items().length === 0,
  );

  /** Settled, and nothing left to show after every filter. */
  readonly feedEmpty = computed(
    () =>
      !this.sessionsStore.loading() && !this.showLoadError() && this._agenda().length === 0,
  );

  /** The chips, the dates or a topic narrowed it, as opposed to the city alone. */
  readonly feedFiltered = computed(() => {
    const filters = this.sessionsStore.filters();
    return !!(
      filters.type ||
      filters.locationKind ||
      filters.dateFrom ||
      filters.dateTo ||
      this.selectedTopic()
    );
  });

  /** Nothing anywhere, before any filter: the catalogue is empty. */
  readonly feedNothingAtAll = computed(
    () => this._sessions().length === 0 && !this.feedFiltered(),
  );

  /**
   * The number on the Filters chip, only while the sheet holds more than a
   * quick chip can say. One thing is on at a time: the sheet, or a chip.
   */
  readonly filterCount = computed(() =>
    sheetBeyondQuickChips(this.sheetFilters()) ? sheetFilterCount(this.sheetFilters()) : 0,
  );

  /** Picks a quick chip set aside, offered again the next time the sheet opens. */
  private readonly _keptSheet = signal<DiscoverSheetFilters | null>(null);

  /** What the sheet opens on: the picks on screen, or the ones set aside. */
  readonly sheetDraft = computed(() =>
    this.filterCount() > 0 ? this.sheetFilters() : (this._keptSheet() ?? this.sheetFilters()),
  );

  isQuickSelected(id: QuickFilterId): boolean {
    return this.filterCount() === 0 && quickFilterSelected(this.sessionsStore.filters(), id);
  }

  /**
   * A quick chip is a view of its own: it sets the sheet's picks aside, date
   * included, and the sheet opens on them again.
   */
  onQuickFilter(id: QuickFilterId): void {
    const chip = this.quickFilters.find((c) => c.id === id);
    if (!chip) return;
    const picks = this.filterCount() > 0 ? this.sheetFilters() : this._keptSheet();
    this.sheetFilters.set({
      ...NO_SHEET_FILTERS,
      type: chip.patch.type ?? null,
      locationKind: chip.patch.locationKind ?? null,
    });
    this._keptSheet.set(picks);
    this.sessionsStore.setFilters({ ...chip.patch, dateFrom: undefined, dateTo: undefined });
  }

  openFilters(): void {
    this.filterSheetOpen.set(true);
  }

  onFiltersApplied(filters: DiscoverSheetFilters): void {
    this.sheetFilters.set(filters);
    this._keptSheet.set(null);
    const window = compileDatePreset(filters.datePreset, new Date());
    this.sessionsStore.setFilters({
      type: filters.type ?? undefined,
      locationKind: filters.locationKind ?? undefined,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });
  }

  /** The agenda's filters and the topic; the city is a choice of its own. */
  clearFilters(): void {
    this._pickedTopicId.set(null);
    this.sheetFilters.set({ ...NO_SHEET_FILTERS });
    this._keptSheet.set(null);
    this.sessionsStore.setFilters({
      type: undefined,
      locationKind: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  }

  showEverywhere(): void {
    this._prefs.setCity(EVERYWHERE);
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

  // ─── Loading ────────────────────────────────────────────────────────────

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this._myBookingsIndexStore.ensureLoaded(true);
    this._prefs.ensureAccountCity(true);
    this.coachesStore.load({ force: true });
    this.groupsStore.load({ force: true });
    // The spinner hangs on the feed — the other sections settle on their own.
    this.sessionsStore.reload(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.sessionsStore.loadMore(() => void event.target.complete());
  }

  // ─── Navigation (all in Discover's stack, so back returns here) ─────────

  openSearch(): void {
    void this._router.navigateByUrl(this._links.search);
  }

  openCoach(coach: InstructorSearchResult): void {
    if (coach.handle) void this._router.navigate(this._links.person(coach.handle));
  }

  /** The same way in as a profile's Message: the thread, or a draft. */
  messageCoach(coach: InstructorSearchResult): void {
    this._openDirectMessage({
      id: coach.userId,
      firstName: coach.firstName,
      lastName: coach.lastName,
    });
  }

  /** The coach directory, a stack of its own; back returns here. */
  openAllCoaches(): void {
    void this._router.navigateByUrl(COACHES_URL);
  }

  openGroup(groupId: string): void {
    void this._router.navigate(this._links.groupPreview(groupId));
  }

  openAllGroups(): void {
    void this._router.navigateByUrl(this._links.allGroups);
  }

  openSession(instance: PublicSessionInstance): void {
    void this._router.navigate(this._links.session(instance.id));
  }
}
