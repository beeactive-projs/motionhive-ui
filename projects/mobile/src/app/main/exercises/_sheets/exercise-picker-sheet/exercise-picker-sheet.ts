import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';

import { Exercise, ExerciseService, ExerciseSortKey } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SearchbarAutofocusDirective } from '../../../../_shared/directives/searchbar-autofocus.directive';
import { toggleValue } from '../../../../_shared/utils/list.utils';
import { ExerciseRow } from '../../_components/exercise-row/exercise-row';
import { RecentExercisesStore } from '../../recent-exercises.store';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/**
 * Adding exercises to a program, without leaving the program.
 *
 * Deliberately not the full library: building a session is a rhythm — pick,
 * pick, pick, done — and pushing a page with pills, filters and a sort menu
 * between each pick would break it. What is here is a search, the movements
 * this coach actually uses, and multi-select that commits in one go.
 *
 * Recents are per-device and local. There is no endpoint for "what this
 * coach programs most", and their own last picks open the sheet far better
 * than an alphabetical catalogue starting at "3/4 Sit-Up" would.
 *
 * "Full library" is the escape for the movement in neither list — it pushes
 * the real page, so this sheet never has to grow filters of its own.
 */
@Component({
  selector: 'mh-exercise-picker-sheet',
  imports: [
    ExerciseRow,
    HexAvatar,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSkeletonText,
    SearchbarAutofocusDirective,
    SheetShell,
  ],
  templateUrl: './exercise-picker-sheet.html',
  styleUrl: './exercise-picker-sheet.scss',
})
export class ExercisePickerSheet {
  readonly open = model(false);
  /** "Day 2 · Lower body" — what the picked exercises are being added to. */
  readonly context = input('');

  readonly picked = output<Exercise[]>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _recents = inject(RecentExercisesStore);
  private readonly _router = inject(Router);

  readonly query = signal('');
  readonly results = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly selectedIds = signal<string[]>([]);
  readonly skeletonRows = [1, 2, 3, 4];

  private readonly _search = new Subject<string>();

  readonly isSearching = computed(() => this.query().trim().length > 0);

  /** Recents while idle; the server's answer once there is a query. */
  readonly rows = computed(() =>
    this.isSearching() ? this.results() : this._recents.exercises(),
  );

  readonly sectionLabel = computed(() => (this.isSearching() ? 'Results' : 'Recently used'));

  readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  readonly emptyMessage = computed(() =>
    this.isSearching()
      ? 'No exercise matches that name.'
      : 'Nothing here yet — search for a movement, or open the full library.',
  );

  readonly addLabel = computed(() => {
    const count = this.selectedIds().length;
    if (count === 0) return 'Add exercises';
    return `Add ${count} ${count === 1 ? 'exercise' : 'exercises'}`;
  });

  readonly canAdd = computed(() => this.selectedIds().length > 0);

  constructor() {
    // Every opening is a fresh pick — a selection carried over from the last
    // day of the program would be added to this one by accident.
    effect(() => {
      if (!this.open()) return;
      this.query.set('');
      this.results.set([]);
      this.selectedIds.set([]);
    });

    this._search
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        switchMap((term) => {
          const search = term.trim();
          if (!search) return of<Exercise[]>([]);
          return this._exerciseService
            .list({ search, limit: PAGE_SIZE, sort: ExerciseSortKey.Name })
            .pipe(
              map((response) => response.items),
              // Caught inside the switchMap: an error reaching the outer
              // stream would complete it, and every later keystroke would
              // search into a dead subscription.
              catchError(() => of<Exercise[]>([])),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((items) => {
        this.results.set(items);
        this.loading.set(false);
      });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.loading.set(value.trim().length > 0);
    this._search.next(value);
  }

  isOn(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(exercise: Exercise): void {
    this.selectedIds.update((ids) => toggleValue(ids, exercise.id));
  }

  /**
   * Commit the batch, in the order it was tapped — a coach picking a squat
   * then a hinge means that order, and re-sorting it alphabetically on the
   * way out would quietly rewrite their session.
   */
  add(): void {
    const byId = new Map(
      [...this._recents.exercises(), ...this.results()].map((row) => [row.id, row]),
    );
    const chosen = this.selectedIds()
      .map((id) => byId.get(id))
      .filter((exercise): exercise is Exercise => !!exercise);
    if (chosen.length === 0) return;

    chosen.forEach((exercise) => this._recents.push(exercise));
    this.picked.emit(chosen);
    this.open.set(false);
  }

  openLibrary(): void {
    this.open.set(false);
    void this._router.navigateByUrl('/tabs/exercises');
  }
}
