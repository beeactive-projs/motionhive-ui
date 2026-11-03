import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
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
import { Subject, debounceTime } from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  Exercise,
  ExerciseOwnershipFilter,
  ExerciseTaxonomyStore,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { SearchbarAutofocusDirective } from '../../_shared/directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../_shared/directives/searchbar-label.directive';
import { ExerciseRow } from './_components/exercise-row/exercise-row';
import { CreateExerciseRow } from './_components/create-exercise-row/create-exercise-row';
import { OwnExerciseSheets } from './_components/own-exercise-sheets/own-exercise-sheets';
import { ExerciseFilterSheet } from './_sheets/exercise-filter-sheet/exercise-filter-sheet';
import {
  COACH_OWNERSHIP_PILLS,
  EXERCISE_ICONS,
  TRAINEE_OWNERSHIP_PILLS,
  isOwnExercise,
  resultMetaLabel,
} from './exercises.config';
import { ExerciseFilters, ExercisesStore } from './exercises.store';

/** Long enough that a typist is not sending a request per letter. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The exercise library — a pushed page off the menu, for both roles.
 *
 * A coach comes here to keep the movements their programs are built from: to
 * find one, to copy a public one into their own library, to write one the
 * catalogue does not have. A trainee comes to look something up, and to make
 * the odd one the catalogue lacks for their own training: the same create
 * button opens the short form instead of the coach's wizard, their own rows
 * carry a ⋯ to edit or delete them, and "Mine" lists them.
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
    ExerciseRow,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    OwnExerciseSheets,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
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

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

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

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this._clearSearch();
    this.store.setSearch('');
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

  clearNarrowing(): void {
    this.searchOpen.set(false);
    this._clearSearch();
    this.store.clearNarrowing();
  }

  open(exercise: Exercise): void {
    void this._router.navigate(['/tabs/exercises', exercise.id]);
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

  /** Outside coach mode your own rows get the ⋯; a coach edits from the exercise's page. */
  hasMenu(exercise: Exercise): boolean {
    return !this.canAuthor() && isOwnExercise(exercise, this.myUserId());
  }

  openMenu(exercise: Exercise): void {
    this._ownSheets()?.menu(exercise);
  }

  /** Made from here: show it where it now lives, among your own. */
  onCreated(): void {
    if (this.store.ownership() === ExerciseOwnershipFilter.Mine) this.store.refresh();
    else this.store.setOwnership(ExerciseOwnershipFilter.Mine);
  }

  onChanged(): void {
    this.store.refresh();
  }

  /** From the coach's empty Mine state — the fastest library is somebody else's. */
  browsePublic(): void {
    this.store.setOwnership(ExerciseOwnershipFilter.PublicOthers);
  }

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
