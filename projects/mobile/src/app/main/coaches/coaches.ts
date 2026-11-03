import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { InstructorSearchResult } from 'core';

import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { PersonRow } from '../../_shared/components/person-row/person-row';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { SearchStart } from '../../_shared/components/search-start/search-start';
import { StaleBar } from '../../_shared/components/stale-bar/stale-bar';
import {
  RecentPerson,
  RecentSearchScopes,
  SuggestedPerson,
  SuggestionStrip,
} from '../../_shared/config/recent-searches.config';
import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { SearchHeaderFold } from '../../_shared/utils/fold';
import { injectRecentSearches } from '../../_shared/utils/recent-searches';
import { personBase } from '../../_shared/utils/stack-paths';
import { CoachRow } from '../discover/_components/coach-row/coach-row';
import { DiscoverPrefs } from '../discover/discover-prefs';
import { CoachesRefreshService } from './_services/coaches-refresh.service';
import { CoachFilterSheet } from './_sheets/coach-filter-sheet/coach-filter-sheet';
import { CoachDirectoryStore } from './coach-directory.store';
import {
  CoachAction,
  CoachActionId,
  CoachActionIds,
  CoachRequestRow,
  CoachRowKinds,
  MyCoachRow,
  recentFromCoach,
  takingClientsStrip,
  visibleCoachActions,
  yourCoachesStrip,
} from './coaches.config';
import {
  COACHES_BACK_DEFAULT,
  COACHES_URL,
  COACH_FILTERS,
  CoachFilterId,
  CoachFilterIds,
  CoachSheetFilters,
  MIN_SEARCH_LENGTH,
  backHrefFrom,
  filterFromUrl,
  nearYouCity,
  sheetFilterCount,
  sheetNarrows,
} from './coaches.filters';
import { COACH_ICONS } from './coaches.icons';
import { CoachesStore } from './coaches.store';

/**
 * The row the verbs sheet is open on, tagged by kind so each branch of
 * `onAction` gets the row type its verbs need and nothing can be handed the
 * wrong one.
 */
type OpenRow =
  | { kind: typeof CoachRowKinds.Invite; row: CoachRequestRow }
  | { kind: typeof CoachRowKinds.Coach; row: MyCoachRow };

/**
 * The Coaches screen: the coach directory as one flat list
 * (`mh-flat-list`), laid out like the Clients tab. A title and the bell, a
 * search field that is always there, then the chips: Filters (the sheet),
 * All, Yours, Requests, Near you and Online. The API pages and filters
 * the directory (`CoachDirectoryStore`); a row opens the coach's profile in
 * this stack.
 *
 * Yours is the reader's own coaches and the invitations waiting on them
 * (`CoachesStore`), the one place on mobile an invitation can be answered.
 * Those invitations also come first on All, since they are the only thing
 * here waiting on the reader. Their rows open the verbs in an action sheet,
 * as a pending client row does on the coach's side.
 *
 * A stack root with three doors (Discover, Home, the Menu): back returns to
 * the one it came through, and Discover's tab button lights throughout.
 */
@Component({
  selector: 'mh-coaches',
  imports: [
    ActionSheet,
    CoachFilterSheet,
    CoachRow,
    ConfirmSheet,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonTitle,
    IonToolbar,
    NotificationBell,
    PersonRow,
    RowSkeleton,
    SearchStart,
    StaleBar,
    TranslatePipe,
  ],
  templateUrl: './coaches.html',
  styleUrl: './coaches.scss',
  host: { class: 'mh-whole-words' },
  providers: [CoachDirectoryStore, CoachesStore],
})
export class Coaches implements ViewWillEnter {
  readonly directory = inject(CoachDirectoryStore);
  readonly store = inject(CoachesStore);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _clockService = inject(ClockService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _discoverPrefs = inject(DiscoverPrefs);
  private readonly _coachesRefreshService = inject(CoachesRefreshService);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _searchbar = viewChild(IonSearchbar);

  readonly recents = injectRecentSearches(RecentSearchScopes.Coaches);

  /** Folds the title, the pills and the back chevron as search opens and closes. */
  readonly fold = new SearchHeaderFold();

  readonly Filters = CoachFilterIds;
  readonly minSearchLength = MIN_SEARCH_LENGTH;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  /** Where back goes: the screen this one was opened from. */
  readonly backHref = signal<string>(COACHES_BACK_DEFAULT);

  readonly searchOpen = signal(false);
  readonly filterSheetOpen = signal(false);

  /** The verbs sheet, and the row it was opened on. */
  readonly sheetOpen = signal(false);
  readonly openRow = signal<OpenRow | null>(null);

  /** Ending a coaching asks first; declining an invitation fires on the tap. */
  readonly leaveOpen = signal(false);
  readonly leaving = signal<MyCoachRow | null>(null);
  readonly leaveSaving = signal(false);

  /**
   * The city "Near you" narrows to. Read from what Discover remembers, and
   * only one the directory has coaches in, so the chip never opens on an
   * empty list.
   */
  private readonly _nearCity = computed(() =>
    nearYouCity(
      this._discoverPrefs.chosenCity(),
      this._discoverPrefs.accountCity(),
      this.directory.facets().cities,
    ),
  );

  /**
   * The chips on show. Near you needs a city, and steps aside while the
   * sheet holds one: two cities at once is a filter nobody can read.
   */
  readonly filters = computed(() =>
    COACH_FILTERS.filter(
      (filter) =>
        filter.id !== CoachFilterIds.NearYou ||
        (!!this._nearCity() && !this.directory.sheet().city),
    ),
  );

  readonly filterCount = computed(() => sheetFilterCount(this.directory.sheet()));

  readonly onYours = computed(() => this.directory.filter() === CoachFilterIds.Yours);

  readonly onRequests = computed(() => this.directory.filter() === CoachFilterIds.Requests);

  /** The reader's coaches by user id, for the "Your coach" badge on a row. */
  readonly coachUserIds = this.store.coachUserIds;

  /**
   * The invitations sit first on Requests, over the reader's own requests,
   * and on All while nothing narrows it: under a search or a filter they
   * would be rows that match nothing typed or picked.
   */
  readonly showInvites = computed(
    () =>
      !this.searchOpen() &&
      this.store.invites().length > 0 &&
      (this.onRequests() ||
        (this.directory.filter() === CoachFilterIds.All &&
          !sheetNarrows(this.directory.sheet()))),
  );

  /** The label over the directory rows, under the invitations. */
  readonly directoryLabel = computed(() =>
    this.onRequests() ? 'coaches.sections.sent' : 'coaches.sections.directory',
  );

  /**
   * The reader's coaches, then coaches taking new clients from the rows
   * already on screen. Neither is a new request.
   */
  readonly strips = computed<SuggestionStrip[]>(() => {
    const recentIds = this.recents.entries().map((person) => person.id);
    const yours = yourCoachesStrip(this.store.coaches(), recentIds);
    const taken = [...recentIds, ...yours.map((person) => person.id), ...this.coachUserIds()];
    return [
      {
        label: this._translateService.instant('coaches.list.yoursStrip'),
        people: yours,
      },
      {
        label: this._translateService.instant('coaches.list.takingStrip'),
        people: takingClientsStrip(this.directory.visibleCoaches(), taken),
      },
    ];
  });

  readonly showSearchStart = computed(
    () =>
      this.searchOpen() &&
      !this.directory.query().trim() &&
      (this.recents.entries().length > 0 ||
        this.strips().some((strip) => strip.people.length > 0)),
  );

  /** Something narrows the directory, so a filtered-empty screen offers Clear. */
  readonly narrowed = computed(
    () =>
      !!this.directory.query().trim() ||
      this.directory.filter() !== CoachFilterIds.All ||
      sheetNarrows(this.directory.sheet()),
  );

  /**
   * What a screen reader is told once a search, a chip or the sheet settles.
   * Nothing on screen says it otherwise: the list simply becomes shorter.
   */
  readonly resultAnnouncement = computed(() => {
    if (this.onYours() || !this.narrowed()) return '';
    if (!this.directory.searchSettled() || this.directory.showSkeleton()) return '';

    const count = this.directory.visibleCoaches().length;
    if (count === 0) return this._translateService.instant('coaches.list.results.none');
    return this._translateService.instant('coaches.list.results.count', { count });
  });

  readonly sheetTitle = computed(() => this.openRow()?.row.person.name ?? '');

  readonly sheetSubtitle = computed(() => this.openRow()?.row.person.subline ?? '');

  readonly actions = computed<readonly CoachAction[]>(() => {
    const open = this.openRow();
    if (!open) return [];
    return visibleCoachActions(open.kind, {
      handle: open.row.handle,
      userId: open.kind === CoachRowKinds.Coach ? open.row.instructorId : open.row.userId,
    });
  });

  readonly leaveTitle = computed(() => {
    const row = this.leaving();
    return row
      ? this._translateService.instant('coaches.confirm.leave.title', { name: row.person.name })
      : this._translateService.instant('coaches.confirm.leave.titleFallback');
  });

  constructor() {
    addIcons(COACH_ICONS);

    // Near you follows the reader's city as it becomes known (the facets and
    // the account city land after the first page). Untracked: the reload it
    // may start reads the whole filter state, which must not re-run this.
    effect(() => {
      const city = this._nearCity();
      untracked(() => this.directory.setNearCity(city));
    });

    // The Menu's Coaches row opens this screen on Yours through `?filter=`.
    // Read on every arrival, since the page stays alive in its stack, but
    // not on a back navigation: that returns to the URL that once carried
    // it, and would undo a chip the reader has changed since.
    let popstate = false;
    this._router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) popstate = event.navigationTrigger === 'popstate';
      if (event instanceof NavigationEnd && !popstate) this._applyUrlFilter(event.urlAfterRedirects);
    });
    this._applyUrlFilter(this._router.url);
  }

  // Not ngOnInit: Ionic keeps the page alive in its stack, so a coach who
  // opened their doors, or an invitation answered elsewhere, has to be picked
  // up on entry. `reenter` holds that back for a few seconds, so stepping into
  // a profile and straight back out does not reload data seconds old; a
  // request sent from that profile is patched onto its row instead.
  ionViewWillEnter(): void {
    this._clockService.bump();
    this._updateBackHref();
    this._discoverPrefs.ensureAccountCity();
    this.directory.reenter();
    this.directory.patchRequests(this._coachesRefreshService.consume());
    this.store.reenter();
  }

  /** All is on only while the sheet is empty: its picks are the view then. */
  isFilterOn(id: CoachFilterId): boolean {
    return (
      this.directory.filter() === id && (id !== CoachFilterIds.All || this.filterCount() === 0)
    );
  }

  setFilter(id: CoachFilterId): void {
    this.directory.setFilter(id);
  }

  openFilters(): void {
    this.filterSheetOpen.set(true);
  }

  applyFilters(filters: CoachSheetFilters): void {
    this.directory.setSheet(filters);
  }

  /**
   * Search covers the whole directory: the pills fold away with the title,
   * so a chip left on would narrow the results with nothing on screen saying
   * so. The sheet's picks are set aside while it is open and come back after.
   */
  openSearch(): void {
    this.fold.arm();
    this.searchOpen.set(true);
    // Only off another chip: on All, picking it again would drop the picks.
    if (this.directory.filter() !== CoachFilterIds.All) {
      this.directory.setFilter(CoachFilterIds.All);
    }
    this.directory.setSearching(true);
  }

  closeSearch(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this.directory.setQuery('');
    this.directory.setSearching(false);
    // Otherwise the field keeps focus, the keyboard stays up, and the next
    // tap on it fires no focus event to open search again.
    void this._searchbar()
      ?.getInputElement()
      .then((input) => input.blur());
  }

  onQuery(value: string): void {
    this.directory.setQuery(value);
  }

  /** Drops the chip, the sheet and the search together, in one request. */
  clearFilters(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this.directory.setSearching(false);
    this.directory.clearFilters();
  }

  /** A directory row: the coach's profile, in this stack. */
  openCoach(coach: InstructorSearchResult): void {
    if (!coach.handle) return;
    // A profile opened from search is where that search ended.
    const recent = this.searchOpen() ? recentFromCoach(coach) : null;
    if (recent) this.recents.push(recent);
    this._openProfile(coach.handle);
  }

  /** A recent or a strip: the person's profile, by the handle it kept. */
  openRecent(person: SuggestedPerson): void {
    if (!person.handle) return;
    this.recents.push(person);
    this._openProfile(person.handle);
  }

  removeRecent(person: RecentPerson): void {
    this.recents.remove(person.id);
  }

  clearRecents(): void {
    this.recents.clear();
  }

  openInvite(row: CoachRequestRow): void {
    this.openRow.set({ kind: CoachRowKinds.Invite, row });
    this.sheetOpen.set(true);
  }

  openMyCoach(row: MyCoachRow): void {
    this.openRow.set({ kind: CoachRowKinds.Coach, row });
    this.sheetOpen.set(true);
  }

  /**
   * The sheet has gone by now, so a verb that navigates or opens one is safe.
   *
   * Dispatched on the row's kind before the verb, so each branch has the row
   * type its verbs need: the request verbs key on a request id, leaving on
   * the coach's account, and nothing can be handed the wrong one.
   */
  onAction(id: CoachActionId): void {
    const open = this.openRow();
    if (!open) return;

    if (id === CoachActionIds.ViewProfile) {
      if (open.row.handle) this._openProfile(open.row.handle);
      return;
    }

    if (open.kind === CoachRowKinds.Coach) {
      if (id === CoachActionIds.Message) this._message(open.row);
      if (id === CoachActionIds.Leave) {
        this.leaving.set(open.row);
        this.leaveOpen.set(true);
      }
      return;
    }

    if (id === CoachActionIds.Accept) this._accept(open.row);
    if (id === CoachActionIds.Decline) this._decline(open.row);
  }

  leave(): void {
    const row = this.leaving();
    if (!row || this.leaveSaving()) return;

    this.leaveSaving.set(true);
    this.store.leave(row.instructorId).subscribe({
      next: () => {
        this.leaveSaving.set(false);
        this.leaveOpen.set(false);
        void this._feedbackService.success(this._translateService.instant('coaches.toast.left'));
      },
      error: (error: unknown) => {
        this.leaveSaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.leaveFailed'),
        );
      },
    });
  }

  /**
   * Both lists at once; the spinner stops when both have settled. A refresh
   * that fails leaves the rows that were there, and the stale bar says so.
   */
  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) void event.target.complete();
    };
    this.directory.refresh(done);
    this.store.refresh(done);
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.directory.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.directory.refresh();
    this.store.refresh();
  }

  private _openProfile(handle: string): void {
    void this._router.navigate([personBase(COACHES_URL), handle]);
  }

  private _message(row: MyCoachRow): void {
    this._openDirectMessage({
      id: row.instructorId,
      firstName: row.firstName,
      lastName: row.lastName,
    });
  }

  private _accept(row: CoachRequestRow): void {
    this.store.accept(row.id).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('coaches.toast.accepted', { name: row.person.name }),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.acceptFailed'),
        ),
    });
  }

  /** Fires on the tap, as declining does on the coach's side: they can ask again. */
  private _decline(row: CoachRequestRow): void {
    this.store.decline(row.id).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('coaches.toast.declined'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.declineFailed'),
        ),
    });
  }

  /**
   * The screen this one was opened from, read off the router: the navigation
   * that brought the reader here remembers the one before it, whether or not
   * it has finished by the time Ionic fires this hook.
   */
  private _updateBackHref(): void {
    const navigation =
      this._router.currentNavigation() ?? this._router.lastSuccessfulNavigation();
    const previous = navigation?.previousNavigation?.finalUrl;
    const url = previous ? this._router.serializeUrl(previous) : null;
    this.backHref.set(backHrefFrom(url, this.backHref()));
  }

  private _applyUrlFilter(url: string): void {
    const id = filterFromUrl(url);
    if (!id) return;
    if (this.searchOpen()) this.closeSearch();
    this.directory.setFilter(id);
  }
}
