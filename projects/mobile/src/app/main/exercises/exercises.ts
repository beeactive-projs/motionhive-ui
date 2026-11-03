import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
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
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Subject, debounceTime } from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  Exercise,
  ExerciseOwnershipFilter,
  ExerciseTaxonomyStore,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { SearchStart } from '../../_shared/components/search-start/search-start';
import { StaleBar } from '../../_shared/components/stale-bar/stale-bar';
import {
  RecentPerson,
  RecentSearchScopes,
  SuggestedPerson,
} from '../../_shared/config/recent-searches.config';
import { SearchbarLabelDirective } from '../../_shared/directives/searchbar-label.directive';
import { SearchHeaderFold } from '../../_shared/utils/fold';
import { injectRecentSearches } from '../../_shared/utils/recent-searches';
import { CreateExerciseRow } from './_components/create-exercise-row/create-exercise-row';
import { ExerciseFlatRow } from './_components/exercise-flat-row/exercise-flat-row';
import { OwnExerciseSheets } from './_components/own-exercise-sheets/own-exercise-sheets';
import { ExerciseFilterSheet } from './_sheets/exercise-filter-sheet/exercise-filter-sheet';
import {
  COACH_OWNERSHIP_PILLS,
  EXERCISE_ICONS,
  TRAINEE_OWNERSHIP_PILLS,
  announceResults,
  isOwnExercise,
  recentFromExercise,
  resultMetaLabel,
} from './exercises.config';
import { ExerciseFilters, ExercisesStore } from './exercises.store';

/** Long enough that a typist is not sending a request per letter. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The exercise library — a pushed page off the menu, for both roles, laid
 * out like the Clients tab: one flat list (`mh-flat-list`) under a search
 * field that is always there and the Filters chip and ownership pills.
 *
 * A coach comes here to keep the movements their programs are built from: to
 * find one, to copy a public one into their own library, to write one the
 * catalogue does not have. A trainee comes to look something up, and to make
 * the odd one the catalogue lacks for their own training: the same "+" opens
 * the short form instead of the coach's wizard, and "Mine" lists them.
 * Either way an exercise of your own swipes to Edit and Delete.
 *
 * The full form is gated on coach *mode*, not just the instructor role: a
 * coach in train mode is a trainee for as long as they are in it, and gets
 * the short form like one.
 */
@Component({
  selector: 'mh-exercises',
  imports: [
    CreateExerciseRow,
    EmptyState,
    ExerciseFilterSheet,
    ExerciseFlatRow,
    IonBackButton,
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
    IonTitle,
    IonToolbar,
    NotificationBell,
    OwnExerciseSheets,
    RowSkeleton,
    SearchStart,
    SearchbarLabelDirective,
    StaleBar,
    TranslatePipe,
  ],
  templateUrl: './exercises.html',
  styleUrl: './exercises.scss',
  providers: [ExercisesStore],
})
export class Exercises implements ViewWillEnter {
  readonly store = inject(ExercisesStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _exerciseTaxonomyStore = inject(ExerciseTaxonomyStore);
  private readonly _router = inject(Router);
  private readonly _searchbar = viewChild(IonSearchbar);

  /** Exercise names are translated, so the list is kept per language too. */
  readonly recents = injectRecentSearches(RecentSearchScopes.Exercises, { perLanguage: true });

  /** Folds the title, the pills and the back chevron as search opens and closes. */
  readonly fold = new SearchHeaderFold();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  /** Focusing the search field folds the title and the pills away. */
  readonly searchOpen = signal(false);
  readonly filterOpen = signal(false);

  /** The raw field value; the committed term lives on the store. */
  readonly searchInput = signal('');
  /** Keystrokes on their way to the store — debounced, and dropped with the page. */
  private readonly _searchTerms = new Subject<string>();

  /** Make, change or delete your own, through the short form. */
  private readonly _ownSheets = viewChild(OwnExerciseSheets);

  /** The coach's full form is the coach workspace's business, not the role's alone. */
  readonly canAuthor = computed(
    () => this._authStore.isInstructor() && this._appModeStore.isCoach(),
  );

  readonly myUserId = computed(() => this._authStore.user()?.id ?? null);

  readonly pills = computed(() =>
    this.canAuthor() ? COACH_OWNERSHIP_PILLS : TRAINEE_OWNERSHIP_PILLS,
  );

  readonly metaLabel = computed(() => resultMetaLabel(this.store.total(), this.store.sort()));

  /** The one slice that mixes owners, so the only one whose rows say whose they are. */
  readonly onAll = computed(() => this.store.ownership() === ExerciseOwnershipFilter.All);

  /** A coach's exercise may sit in programs, so its delete says what happens to them. */
  readonly deleteBody = computed(() =>
    this.canAuthor() ? 'exercises.edit.deleteConfirm.body' : 'exercises.own.deleteBody',
  );

  /** Where Back goes when the page is opened cold from a deep link. */
  readonly backHref = '/tabs/more';

  /**
   * The Mine slice is the one empty state that is a beginning, not a dead
   * end — and only when nothing else narrows it: Mine plus a search that
   * matches nothing is an ordinary "nothing matches".
   */
  readonly isMineEmpty = computed(
    () =>
      this.store.ownership() === ExerciseOwnershipFilter.Mine &&
      !this.store.hasNarrowing() &&
      this.store.isFilteredEmpty(),
  );

  /**
   * Search is open and nothing is typed yet: the exercises the last searches
   * ended on, as Clients opens its search. With none of them the list stays,
   * which is still something to search through.
   */
  readonly showSearchStart = computed(
    () =>
      this.searchOpen() && !this.searchInput().trim() && this.recents.entries().length > 0,
  );

  /**
   * What a screen reader is told once a search, a pill or the sheet settles.
   * Empty while a term is still on its way, and empty when nothing narrows
   * the list, where the count is just the catalogue's size.
   */
  readonly resultAnnouncement = computed(() => {
    const term = this.searchInput().trim();
    const narrowing =
      !!term ||
      this.store.ownership() !== ExerciseOwnershipFilter.All ||
      this.store.activeFilterCount() > 0;
    const settled = term === this.store.search() && !this.store.loading();
    if (!narrowing || !settled || this.store.showSkeleton()) return '';
    return announceResults(this.store.total());
  });

  constructor() {
    addIcons(EXERCISE_ICONS);
    // The filter sheet renders muscle and equipment names, and the create
    // form picks from the same lists. Cached after the first screen.
    this._exerciseTaxonomyStore.ensureLoaded();

    // The field tracks every letter; the request waits for the typist to
    // pause. Same shape as the picker and the filter sheet's recount.
    this._searchTerms
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((term) => this.store.setSearch(term));
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, and an
  // exercise created, edited or deleted on a pushed page changes this list.
  // The store re-reads the loaded window in place, so the scroll holds.
  ionViewWillEnter(): void {
    this.store.refresh();
  }

  setOwnership(value: ExerciseOwnershipFilter): void {
    this.store.setOwnership(value);
  }

  /**
   * Search covers the whole library: the pills fold away with the title, so
   * a pill left on would narrow the results with nothing on screen saying
   * so. All sets the sheet's picks aside too; the sheet reopens on them.
   */
  openSearch(): void {
    if (this.searchOpen()) return;
    this.fold.arm();
    this.searchOpen.set(true);
    if (!this.store.isOwnershipOn(ExerciseOwnershipFilter.All)) {
      this.store.setOwnership(ExerciseOwnershipFilter.All);
    }
  }

  closeSearch(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this._clearSearch();
    this.store.setSearch('');
    // Otherwise the field keeps focus, the keyboard stays up, and the next
    // tap on it fires no focus event to open search again.
    void this._searchbar()
      ?.getInputElement()
      .then((input) => input.blur());
  }

  onQuery(value: string): void {
    this.searchInput.set(value);
    this._searchTerms.next(value);
  }

  openFilters(): void {
    this.filterOpen.set(true);
  }

  applyFilters(filters: ExerciseFilters): void {
    this.store.setFilters(filters);
  }

  /** Drops the pill, the sheet's picks and the search together. */
  clearNarrowing(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this._clearSearch();
    this.store.clearNarrowing();
  }

  open(exercise: Exercise): void {
    // An exercise opened from search is where that search ended.
    if (this.searchOpen()) this.recents.push(recentFromExercise(exercise));
    void this._router.navigate(['/tabs/exercises', exercise.id]);
  }

  /** A recent: remembered again, so it moves to the top, then its page. */
  openRecent(entry: SuggestedPerson): void {
    this.recents.push(entry);
    void this._router.navigate(['/tabs/exercises', entry.id]);
  }

  removeRecent(entry: RecentPerson): void {
    this.recents.remove(entry.id);
  }

  clearRecents(): void {
    this.recents.clear();
  }

  /** From a search that found nothing by that name: the form starts from it. */
  createFromSearch(name: string): void {
    if (this.canAuthor()) {
      void this._router.navigate(['/tabs/exercises/new'], { queryParams: { name } });
      return;
    }
    this._ownSheets()?.create(name);
  }

  /** A coach in coach mode gets the wizard; everyone else the short form. */
  create(): void {
    if (this.canAuthor()) {
      void this._router.navigateByUrl('/tabs/exercises/new');
      return;
    }
    this._ownSheets()?.create();
  }

  /** You made it, so you can change it or delete it: the row swipes. */
  isOwn(exercise: Exercise): boolean {
    return isOwnExercise(exercise, this.myUserId());
  }

  /** The form that made it: the coach's edit page in coach mode, the short form elsewhere. */
  edit(exercise: Exercise): void {
    if (this.canAuthor()) {
      void this._router.navigate(['/tabs/exercises', exercise.id, 'edit']);
      return;
    }
    this._ownSheets()?.edit(exercise);
  }

  confirmDelete(exercise: Exercise): void {
    this._ownSheets()?.confirmDelete(exercise);
  }

  /** Made from here: show it where it now lives, among your own. */
  onCreated(): void {
    if (this.store.ownership() === ExerciseOwnershipFilter.Mine) this.store.refresh();
    else this.store.setOwnership(ExerciseOwnershipFilter.Mine);
  }

  onChanged(): void {
    this.store.refresh();
  }

  /** Gone, so it stops being a shortcut as well. */
  onDeleted(id: string): void {
    this.recents.remove(id);
    this.store.refresh();
  }

  /** From the coach's empty Mine state — the fastest library is somebody else's. */
  browsePublic(): void {
    this.store.setOwnership(ExerciseOwnershipFilter.PublicOthers);
  }

  /**
   * A refresh that fails leaves the rows that were already there, and the
   * stale bar above the list says so and offers the retry.
   */
  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  /**
   * Empties the field and supersedes any keystroke still waiting in the
   * debounce: the empty term is what lands, and it is a no-op against a
   * store the caller has already cleared.
   */
  private _clearSearch(): void {
    this.searchInput.set('');
    this._searchTerms.next('');
  }
}
