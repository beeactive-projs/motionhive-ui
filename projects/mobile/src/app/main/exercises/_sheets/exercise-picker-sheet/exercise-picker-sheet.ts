import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  InfiniteScrollCustomEvent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { take } from 'rxjs/operators';

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
 * Adding exercises to a routine or a live workout, without leaving it.
 *
 * The whole catalog is browsable **here**, paginated. It used to push the
 * exercises page instead, which tore down whatever was half-built behind the
 * sheet — a routine with four exercises in it and no id yet was simply gone.
 * Nothing in this sheet navigates.
 *
 * Idle shows the movements you actually use, then the catalog underneath.
 * Typing replaces both with server-side results, paginated the same way.
 *
 * Recents are per-device and local: there is no endpoint for "what this
 * person programs most", and their own last picks open the sheet far better
 * than an alphabetical catalogue starting at "3/4 Sit-Up".
 */
@Component({
  selector: 'mh-exercise-picker-sheet',
  imports: [
    ExerciseRow,
    HexAvatar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
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
  /** Already in the list behind the sheet; shown as picked and not re-addable. */
  readonly alreadyAdded = input<readonly string[]>([]);

  readonly picked = output<Exercise[]>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _recents = inject(RecentExercisesStore);

  readonly query = signal('');
  readonly results = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly selectedIds = signal<string[]>([]);
  readonly skeletonRows = [1, 2, 3, 4];

  private readonly _page = signal(1);
  private readonly _total = signal(0);
  private readonly _search = new Subject<string>();

  readonly isSearching = computed(() => this.query().trim().length > 0);

  /** Your own last picks, hidden while searching and when already added. */
  readonly recents = computed(() => {
    if (this.isSearching()) return [];
    const added = new Set(this.alreadyAdded());
    return this._recents.exercises().filter((e) => !added.has(e.id));
  });

  readonly rows = computed(() => {
    const seen = new Set([...this.recents().map((e) => e.id), ...this.alreadyAdded()]);
    // Two kinds of duplicate to drop: what the recents rail above already
    // shows, and what is already in the list behind the sheet. Offering a
    // movement you cannot add twice is just a tap that does nothing.
    return this.results().filter((e) => !seen.has(e.id));
  });

  readonly sectionLabel = computed(() =>
    this.isSearching() ? 'Results' : 'All exercises',
  );

  readonly isEmpty = computed(
    () => !this.loading() && this.rows().length === 0 && this.recents().length === 0,
  );

  readonly emptyMessage = computed(() =>
    this.isSearching()
      ? 'No exercise matches that name.'
      : 'The catalog could not be loaded. Check your connection.',
  );

  readonly hasMore = computed(() => this.results().length < this._total());

  readonly addLabel = computed(() => {
    const count = this.selectedIds().length;
    if (count === 0) return 'Add exercises';
    return `Add ${count} ${count === 1 ? 'exercise' : 'exercises'}`;
  });

  readonly canAdd = computed(() => this.selectedIds().length > 0);

  constructor() {
    // Every opening is a fresh pick — a selection carried over from the last
    // time would be added to this list by accident.
    effect(() => {
      if (!this.open()) return;
      this.query.set('');
      this.selectedIds.set([]);
      this._loadFirstPage('');
    });

    this._search
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        switchMap((term) => {
          this._page.set(1);
          return this._fetch(term.trim(), 1).pipe(
            // Caught inside the switchMap: an error reaching the outer stream
            // would complete it, and every later keystroke would search into
            // a dead subscription.
            catchError(() => of({ items: [] as Exercise[], total: 0 })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.results.set(page.items);
        this._total.set(page.total);
        this.loading.set(false);
      });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.loading.set(true);
    this._search.next(value);
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    if (!this.hasMore() || this.loadingMore()) {
      void event.target.complete();
      return;
    }
    this.loadingMore.set(true);
    const next = this._page() + 1;

    this._fetch(this.query().trim(), next)
      .pipe(
        take(1),
        catchError(() => of({ items: [] as Exercise[], total: this._total() })),
      )
      .subscribe((page) => {
        this._page.set(next);
        this.results.update((rows) => [...rows, ...page.items]);
        this._total.set(page.total);
        this.loadingMore.set(false);
        void event.target.complete();
      });
  }

  isOn(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(exercise: Exercise): void {
    this.selectedIds.update((ids) => toggleValue(ids, exercise.id));
  }

  /**
   * Commit the batch, in the order it was tapped — picking a squat then a
   * hinge means that order, and re-sorting alphabetically on the way out
   * would quietly rewrite the session.
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

  private _loadFirstPage(term: string): void {
    this.loading.set(true);
    this._page.set(1);
    this._fetch(term, 1)
      .pipe(
        take(1),
        catchError(() => of({ items: [] as Exercise[], total: 0 })),
      )
      .subscribe((page) => {
        this.results.set(page.items);
        this._total.set(page.total);
        this.loading.set(false);
      });
  }

  private _fetch(search: string, page: number) {
    return this._exerciseService
      .list({
        ...(search ? { search } : {}),
        page,
        limit: PAGE_SIZE,
        sort: ExerciseSortKey.Name,
      })
      .pipe(map((response) => ({ items: response.items, total: response.total })));
  }
}
