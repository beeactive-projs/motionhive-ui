import { Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
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

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SearchbarLabelDirective } from '../../../../_shared/directives/searchbar-label.directive';
import { ExerciseFilterSheet } from '../../_sheets/exercise-filter-sheet/exercise-filter-sheet';
import {
  COACH_OWNERSHIP_PILLS,
  EXERCISE_ICONS,
  TRAINEE_OWNERSHIP_PILLS,
  isOwnExercise,
  resultMetaLabel,
} from '../../exercises.config';
import { ExerciseFilters, ExercisesStore } from '../../exercises.store';
import { ExerciseRow } from '../exercise-row/exercise-row';
import { CreateExerciseRow } from '../create-exercise-row/create-exercise-row';
import { OwnExerciseSheets } from '../own-exercise-sheets/own-exercise-sheets';

/** Long enough that a typist is not sending a request per letter. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The exercise library as a page's section: the field, the filter strip and
 * the list, a page at a time with Show more. The Workouts page's Exercises
 * tab; the library's own page keeps its header search and the coach's
 * authoring. Here a person makes and keeps their own exercises through the
 * short form: "New exercise" over the list, a ⋯ on each of their rows.
 *
 * Its state is the host's `ExercisesStore`, so switching tabs keeps the
 * place; the host refreshes it when the section shows. `detailBase` is where
 * an exercise opens, in the host's stack so back returns to it.
 */
@Component({
  selector: 'mh-exercise-library',
  imports: [
    CreateExerciseRow,
    EmptyState,
    ExerciseFilterSheet,
    ExerciseRow,
    HexAvatar,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSkeletonText,
    OwnExerciseSheets,
    SearchbarLabelDirective,
    TranslatePipe,
  ],
  templateUrl: './exercise-library.html',
  styleUrl: './exercise-library.scss',
})
export class ExerciseLibrary {
  readonly store = inject(ExercisesStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _router = inject(Router);

  /** Where an exercise opens, as router commands before its id. */
  readonly detailBase = input<readonly string[]>(['/tabs/exercises']);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly filterOpen = signal(false);
  /**
   * The raw field value; the committed term lives on the store, which
   * outlives this tab. Seeded from it, so coming back to the tab shows the
   * term the list is still narrowed by, and a clear empties the field too.
   */
  readonly searchInput = linkedSignal(() => this.store.search());
  private readonly _searchTerms = new Subject<string>();

  /** The coach's full form is the coach workspace's business, not the role's alone. */
  private readonly _canAuthor = computed(
    () => this._authStore.isInstructor() && this._appModeStore.isCoach(),
  );

  /**
   * Your own exercises through the short form. Offered outside coach mode
   * only: a coach in coach mode authors from the library's own page, where
   * the full form lives.
   */
  readonly canKeepOwn = computed(() => !this._canAuthor());

  private readonly _ownSheets = viewChild(OwnExerciseSheets);

  readonly myUserId = computed(() => this._authStore.user()?.id ?? null);

  readonly pills = computed(() =>
    this._canAuthor() ? COACH_OWNERSHIP_PILLS : TRAINEE_OWNERSHIP_PILLS,
  );

  readonly metaLabel = computed(() => resultMetaLabel(this.store.total(), this.store.sort()));

  /**
   * Mine with nothing in it and nothing narrowing it: a beginning, with the
   * way to make one, not "nothing matches".
   */
  readonly isMineEmpty = computed(
    () =>
      this.canKeepOwn() &&
      this.store.ownership() === ExerciseOwnershipFilter.Mine &&
      !this.store.hasNarrowing() &&
      this.store.isFilteredEmpty(),
  );

  constructor() {
    addIcons(EXERCISE_ICONS);
    // The filter sheet renders muscle and equipment names. Cached after the first screen.
    inject(ExerciseTaxonomyStore).ensureLoaded();

    // The field tracks every letter; the request waits for the typist to pause.
    this._searchTerms
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((term) => this.store.setSearch(term));

  }

  onQuery(value: string): void {
    this.searchInput.set(value);
    this._searchTerms.next(value);
  }

  setOwnership(value: ExerciseOwnershipFilter): void {
    this.store.setOwnership(value);
  }

  applyFilters(filters: ExerciseFilters): void {
    this.store.setFilters(filters);
  }

  clearNarrowing(): void {
    this.searchInput.set('');
    this._searchTerms.next('');
    this.store.clearNarrowing();
  }

  open(exercise: Exercise): void {
    void this._router.navigate([...this.detailBase(), exercise.id]);
  }

  retry(): void {
    this.store.refresh();
  }

  /** From a search that found nothing by that name: the form starts from it. */
  createFromSearch(name: string): void {
    this._ownSheets()?.create(name);
  }

  create(): void {
    this._ownSheets()?.create();
  }

  hasMenu(exercise: Exercise): boolean {
    return this.canKeepOwn() && isOwnExercise(exercise, this.myUserId());
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
}
