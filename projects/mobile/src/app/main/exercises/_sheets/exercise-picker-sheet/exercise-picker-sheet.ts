import { NgTemplateOutlet } from '@angular/common';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime } from 'rxjs';

import { Exercise, ExerciseService, ExerciseSortKey } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SearchbarAutofocusDirective } from '../../../../_shared/directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../../../_shared/directives/searchbar-label.directive';
import { PagedList } from '../../../../_shared/utils/paged-list';
import { ExerciseRow } from '../../_components/exercise-row/exercise-row';
import { hasExactNameMatch } from '../../exercises.config';
import { RecentExercisesStore } from '../../recent-exercises.store';
import { ExerciseFormSheet } from '../exercise-form-sheet/exercise-form-sheet';
import { CreateExerciseRow } from '../../_components/create-exercise-row/create-exercise-row';
import { ExercisePreviewSheet } from '../exercise-preview-sheet/exercise-preview-sheet';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/**
 * Adding exercises to a routine or a live workout, without leaving it.
 *
 * When a search finds nothing by that exact name, the last row offers to
 * make it: the short form opens over the picker with the name already in
 * it, and the new exercise comes back through `picked` like any other, with
 * whatever was ticked before it. Private to whoever made it, so anyone can.
 *
 * The whole catalog is browsable **here**, paginated. It used to push the
 * exercises page instead, which tore down whatever was half-built behind the
 * sheet — a routine with four exercises in it and no id yet was simply gone.
 * Nothing in this sheet navigates.
 *
 * Idle shows the movements you actually use, then the catalog underneath.
 * Typing replaces both with server-side results, paginated the same way.
 *
 * Recents are per-device and local: the last picks, in the order they were
 * made. The catalog under them comes the most used first (this person's own
 * workouts and routines, then everyone's), and a search the best match first:
 * both are the API's `relevance` order.
 */
@Component({
  selector: 'mh-exercise-picker-sheet',
  imports: [
    CreateExerciseRow,
    ExerciseFormSheet,
    ExerciseRow,
    ExercisePreviewSheet,
    HexAvatar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSkeletonText,
    NgTemplateOutlet,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './exercise-picker-sheet.html',
  styleUrl: './exercise-picker-sheet.scss',
})
export class ExercisePickerSheet {
  readonly open = model(false);
  /** "Day 2 · Lower body" — what the picked exercises are being added to. */
  readonly context = input('');
  /**
   * Swapping reuses this sheet, and a sheet headed "Add exercises" while it
   * is about to replace something is exactly the ambiguity we are trying to
   * remove. Callers say what the sheet is for. Empty falls back to
   * "Add exercises".
   */
  readonly title = input('');
  /** Already translated by the caller ("Add", "Swap for"); empty falls back to "Add". */
  readonly confirmVerb = input('');
  /** One out, one in: swapping is a single choice, not a batch. */
  readonly single = input(false);
  /** Already in the list behind the sheet; shown as picked and not re-addable. */
  readonly alreadyAdded = input<readonly string[]>([]);

  readonly picked = output<Exercise[]>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _recentExercisesStore = inject(RecentExercisesStore);
  private readonly _translateService = inject(TranslateService);

  readonly query = signal('');
  readonly skeletonRows = [1, 2, 3, 4];

  /**
   * The catalog or a search, a page at a time, for `_term`. A newer read
   * cancels the one on its way, a page never repeats a row already shown,
   * a failed page is asked for again, and a short page is the end.
   */
  private readonly _list = new PagedList<Exercise>(PAGE_SIZE, (page, limit) =>
    this._exerciseService.list({
      ...(this._term ? { search: this._term } : {}),
      page,
      limit,
      // Best match first while searching; the most used first while browsing.
      sort: ExerciseSortKey.Relevance,
    }),
  );
  /** What `_list` reads: the term of the rows on screen, or of the read replacing them. */
  private _term = '';
  private readonly _search = new Subject<{ term: string; generation: number }>();
  /** The term the rows on screen answer, which lags `query` while a search is in flight. */
  private readonly _shownTerm = signal('');
  /** A newer term than the rows on screen is on its way. */
  private readonly _pending = signal(false);
  /**
   * Bumped by every keystroke and every opening. A search from an older
   * one is not sent, and an answer to one does not settle the sheet.
   */
  private _generation = 0;
  /**
   * The picks, whole and in the order tapped. Whole, because a pick made
   * under an earlier search is no longer among the rows on screen by the
   * time Add is pressed.
   */
  private readonly _selected = signal<ReadonlyMap<string, Exercise>>(new Map());

  /** Nothing answered since opening: the skeleton. Later keystrokes keep the last answer instead. */
  readonly loading = computed(() => !this._list.loaded());

  readonly isSearching = computed(() => this._shownTerm().length > 0);

  /** Your own last picks, hidden while searching. */
  readonly recents = computed(() =>
    this.isSearching() ? [] : this._recentExercisesStore.exercises(),
  );

  /** The answer to the shown term. A failed one has none: the rows left are an older term's. */
  private readonly _results = computed(() => (this._list.failed() ? [] : this._list.items()));

  readonly rows = computed(() => {
    // The catalog repeats what the recents rail already shows; drop those so
    // a movement never appears twice in one sheet.
    const recentIds = new Set(this.recents().map((e) => e.id));
    return this._results().filter((e) => !recentIds.has(e.id));
  });

  /**
   * Already in the list behind the sheet. Shown ticked and locked rather
   * than hidden: a row that vanishes reads as "not in the catalog", and the
   * user reopening the sheet could not tell what they had already picked.
   */
  isLocked(id: string): boolean {
    return this.alreadyAdded().includes(id);
  }

  readonly sheetTitle = computed<string>(
    () => this.title() || this._translateService.instant('exercises.picker.addExercises'),
  );

  private readonly _verb = computed<string>(
    () => this.confirmVerb() || this._translateService.instant('button.add'),
  );

  readonly sectionLabel = computed<string>(() =>
    this._translateService.instant(
      this.isSearching() ? 'exercises.picker.results' : 'exercises.picker.allExercises',
    ),
  );

  readonly isEmpty = computed(
    () => !this.loading() && this.rows().length === 0 && this.recents().length === 0,
  );

  /** A failed search says so: "No match" would offer to create one that exists. */
  readonly emptyMessage = computed<string>(() =>
    this._translateService.instant(
      this.isSearching() && !this._list.failed()
        ? 'exercises.picker.noMatch'
        : 'exercises.picker.loadError',
    ),
  );

  readonly hasMore = computed(() => !this._list.failed() && this._list.hasMore());

  readonly addLabel = computed<string>(() => {
    const count = this._selected().size;
    const verb = this._verb();
    if (this.single()) {
      return count === 0
        ? verb
        : this._translateService.instant('exercises.picker.confirmSingle', { verb });
    }
    if (count === 0) return this.sheetTitle();
    return this._translateService.instant('exercises.picker.confirmCount', { verb, count });
  });

  readonly canAdd = computed(() => this._selected().size > 0);

  /**
   * "Can't find it? Create it": offered once a search has settled without
   * an exercise of exactly that name. Near matches stay above it as
   * suggestions; the row is the way out when none of them is the one.
   *
   * While the next term is on its way the row stays if the last answer
   * offered it, so it does not blink under a finger still typing. An exact
   * name already on screen takes it away at once, and a failed search
   * never offers it: the exercise may well exist.
   */
  readonly canCreate = computed(() => {
    if (!this.isSearching() || this.loading() || this._list.failed() || !this.createName()) {
      return false;
    }
    const onScreen = [...this._results(), ...this._recentExercisesStore.exercises()];
    if (hasExactNameMatch(this.query(), onScreen)) return false;
    return !this._pending() || !hasExactNameMatch(this._shownTerm(), onScreen);
  });

  /** The trimmed search, as the create row quotes it and the form starts from it. */
  readonly createName = computed(() => this.query().trim());

  readonly createOpen = signal(false);

  constructor() {
    // Every opening is a fresh pick — a selection carried over from the last
    // time would be added to this list by accident.
    effect(() => {
      if (!this.open()) return;
      const generation = ++this._generation;
      this.query.set('');
      this._selected.set(new Map());
      this._shownTerm.set('');
      this._list.clear();
      this._read('', generation);
    });

    this._search
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe(({ term, generation }) => this._read(term, generation));
  }

  onQuery(value: string): void {
    this.query.set(value);
    // The rows on screen stay until the next ones replace them; only what
    // they answer is out of date now.
    this._pending.set(true);
    this._search.next({ term: value.trim(), generation: ++this._generation });
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    const done = () => void event.target.complete();
    // A page of the last term must never land under the next one's results.
    if (this._pending() || !this.hasMore()) {
      done();
      return;
    }
    this._list.more(done);
  }

  isOn(id: string): boolean {
    return this._selected().has(id) || this.isLocked(id);
  }

  /** The exercise being looked at, which is not the same as being picked. */
  readonly previewing = signal<Exercise | null>(null);
  readonly previewOpen = signal(false);

  preview(exercise: Exercise): void {
    this.previewing.set(exercise);
    this.previewOpen.set(true);
  }

  toggle(exercise: Exercise): void {
    // Removal is done from the list itself, not from here.
    if (this.isLocked(exercise.id)) return;
    // A swap replaces one movement with one movement, so the last tap wins
    // rather than accumulating a batch that cannot be applied.
    if (this.single()) {
      this._selected.set(this.isOn(exercise.id) ? new Map() : new Map([[exercise.id, exercise]]));
      return;
    }
    this._selected.update((picked) => {
      const next = new Map(picked);
      if (!next.delete(exercise.id)) next.set(exercise.id, exercise);
      return next;
    });
  }

  /**
   * Commit the batch, in the order it was tapped — picking a squat then a
   * hinge means that order, and re-sorting alphabetically on the way out
   * would quietly rewrite the session.
   */
  add(): void {
    const chosen = [...this._selected().values()];
    if (chosen.length === 0) return;

    chosen.forEach((exercise) => this._recentExercisesStore.push(exercise));
    this.picked.emit(chosen);
    this.open.set(false);
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  /**
   * Made from the search: added like a pick, after anything already ticked
   * (a swap takes it alone), and the picker closes, as Add would. The form
   * has already gone by now, so the two sheets leave one after the other.
   */
  onCreated(exercise: Exercise): void {
    this._recentExercisesStore.push(exercise);

    if (this.single()) {
      this.picked.emit([exercise]);
      this.open.set(false);
      return;
    }

    const chosen = [...this._selected().values()].filter((row) => row.id !== exercise.id);
    chosen.forEach((row) => this._recentExercisesStore.push(row));
    this.picked.emit([...chosen, exercise]);
    this.open.set(false);
  }

  /**
   * `term`'s first page, in place of the rows on screen once it lands,
   * unless a newer keystroke or opening came since. Its answer, rows or a
   * failure, settles the sheet only if none has come by then either.
   */
  private _read(term: string, generation: number): void {
    if (generation !== this._generation) return;
    this._term = term;
    this._pending.set(true);
    this._list.reset(() => {
      if (generation !== this._generation) return;
      this._shownTerm.set(term);
      this._pending.set(false);
    });
  }
}
