import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonChip, IonNote } from '@ionic/angular/standalone';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';

import {
  ExerciseFacets,
  ExerciseKind,
  ExerciseLevel,
  ExerciseOwnershipFilter,
  ExerciseService,
  ExerciseTaxonomyStore,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { toggleValue } from '../../../../_shared/utils/list.utils';
import {
  KIND_ORDER,
  LEVEL_ORDER,
  LabelledOption,
  kindLabel,
  levelLabel,
} from '../../exercises.config';
import {
  ExerciseFilters,
  NO_FILTERS,
  filterCount,
  filtersToQuery,
} from '../../exercises.store';

/** A chip in one of the clouds: what it filters by, and how many rows it would leave. */
interface FilterChip<T> extends LabelledOption<T> {
  count: number | null;
}

/** Muscles shown before the cloud has to be asked to expand. */
const MUSCLE_PREVIEW = 8;

/**
 * Narrow the library: kind, level, primary muscle, equipment.
 *
 * Counts come from the same request that filled the list (`withFacets`), so
 * the numbers beside each chip are the catalogue's, not a guess. They follow
 * classic facet semantics — each count respects every filter except its own
 * group — which is why tapping a second kind does not zero the first.
 *
 * Edits are local until Apply, so a half-set filter never flickers the list
 * behind the sheet. The footer still recounts live: the point of a filter
 * sheet is knowing what you will get before you commit to it, and "Show 0
 * exercises" is worth seeing before the list is empty.
 *
 * Pattern, mechanic and force stay web-only for now — four groups is already
 * the most a phone screen can hold without turning into a form.
 */
@Component({
  selector: 'mh-exercise-filter-sheet',
  imports: [IonChip, IonNote, SheetShell],
  templateUrl: './exercise-filter-sheet.html',
  styleUrl: './exercise-filter-sheet.scss',
})
export class ExerciseFilterSheet {
  readonly open = model(false);
  readonly filters = input<ExerciseFilters>(NO_FILTERS);
  readonly facets = input<ExerciseFacets | undefined>(undefined);
  /** The rest of the query, so the footer's count matches what Apply will show. */
  readonly ownership = input<ExerciseOwnershipFilter>(ExerciseOwnershipFilter.All);
  readonly search = input('');

  readonly applied = output<ExerciseFilters>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _taxonomy = inject(ExerciseTaxonomyStore);

  readonly draft = signal<ExerciseFilters>(NO_FILTERS);
  readonly musclesExpanded = signal(false);

  /** Null while the recount is in flight — the footer keeps the last number. */
  readonly previewTotal = signal<number | null>(null);
  private readonly _recount = new Subject<void>();

  readonly kindChips = computed<FilterChip<ExerciseKind>[]>(() => {
    const counts = this.facets()?.kind;
    return KIND_ORDER.map((value) => ({
      value,
      label: kindLabel(value),
      count: countOf(counts, value),
    }));
  });

  readonly levelChips = computed<FilterChip<ExerciseLevel>[]>(() => {
    const counts = this.facets()?.level;
    return LEVEL_ORDER.map((value) => ({
      value,
      label: levelLabel(value),
      count: countOf(counts, value),
    }));
  });

  /**
   * Muscles ordered by how much of the catalogue they cover, so the eight on
   * show are the eight worth showing. A muscle already picked is always in
   * that set — a selected chip hidden behind "show all" reads as a filter
   * that silently unset itself.
   */
  private readonly _allMuscleChips = computed<FilterChip<string>[]>(() => {
    const counts = this.facets()?.primaryMuscleId;
    return this._taxonomy
      .muscles()
      .map((muscle) => ({
        value: muscle.id,
        label: muscle.commonName,
        count: countOf(counts, muscle.id),
      }))
      .sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  });

  readonly muscleChips = computed<FilterChip<string>[]>(() => {
    const all = this._allMuscleChips();
    if (this.musclesExpanded()) return all;

    const selected = new Set(this.draft().muscleIds);
    const head = all.slice(0, MUSCLE_PREVIEW);
    const shown = new Set(head.map((chip) => chip.value));
    const missing = all.filter((chip) => selected.has(chip.value) && !shown.has(chip.value));
    return [...head, ...missing];
  });

  readonly hiddenMuscleCount = computed(
    () => this._allMuscleChips().length - this.muscleChips().length,
  );

  readonly equipmentChips = computed<FilterChip<string>[]>(() => {
    const counts = this.facets()?.equipmentId;
    return this._taxonomy
      .equipment()
      .map((row) => ({
        value: row.id,
        label: row.name,
        count: countOf(counts, row.id),
      }))
      .sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  });

  readonly count = computed(() => filterCount(this.draft()));

  readonly applyLabel = computed(() => {
    const total = this.previewTotal();
    if (total === null) return 'Show exercises';
    const noun = total === 1 ? 'exercise' : 'exercises';
    return `Show ${total} ${noun}`;
  });

  readonly showAllMusclesLabel = computed(
    () => `All ${this._allMuscleChips().length} muscles…`,
  );

  constructor() {
    this._taxonomy.ensureLoaded();

    // Seed from what is applied each time it opens, so a dismissed edit is
    // discarded rather than carried into the next visit.
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...this.filters() });
      this.musclesExpanded.set(false);
      this.previewTotal.set(null);
      this._recount.next();
    });

    // One request per settled edit, and only the newest one is listened to.
    this._recount
      .pipe(
        debounceTime(250),
        switchMap(() => {
          const draft = this.draft();
          const term = this.search().trim();
          return this._exerciseService
            .list({
              page: 1,
              // The body is not read — only `total` is — so ask for the
              // smallest page the endpoint will serve.
              limit: 1,
              ownership: this.ownership(),
              search: term || undefined,
              ...filtersToQuery(draft),
            })
            .pipe(
              map((response) => response.total),
              // Caught inside the switchMap, not at the subscriber: an error
              // reaching the outer stream would complete it, and every later
              // chip tap would recount into a dead subscription. A failed
              // recount keeps the last number rather than inventing one.
              catchError(() => of(this.previewTotal())),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((total) => this.previewTotal.set(total));
  }

  isKindOn(value: ExerciseKind): boolean {
    return this.draft().kinds.includes(value);
  }

  isLevelOn(value: ExerciseLevel): boolean {
    return this.draft().levels.includes(value);
  }

  isMuscleOn(id: string): boolean {
    return this.draft().muscleIds.includes(id);
  }

  isEquipmentOn(id: string): boolean {
    return this.draft().equipmentIds.includes(id);
  }

  toggleKind(value: ExerciseKind): void {
    this._patch({ kinds: toggleValue(this.draft().kinds, value) });
  }

  toggleLevel(value: ExerciseLevel): void {
    this._patch({ levels: toggleValue(this.draft().levels, value) });
  }

  toggleMuscle(id: string): void {
    this._patch({ muscleIds: toggleValue(this.draft().muscleIds, id) });
  }

  toggleEquipment(id: string): void {
    this._patch({ equipmentIds: toggleValue(this.draft().equipmentIds, id) });
  }

  expandMuscles(): void {
    this.musclesExpanded.set(true);
  }

  /**
   * Reset is a decision, not an edit: it lands and closes, like Apply. No
   * recount — the sheet reseeds and recounts on its next open.
   */
  reset(): void {
    this.draft.set({ ...NO_FILTERS });
    this.apply();
  }

  apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }

  private _patch(patch: Partial<ExerciseFilters>): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
    this._recount.next();
  }
}

/**
 * The count for one chip. The API leaves a facet out entirely when nothing
 * matches it, so an absent key is a real zero — rendering it as "no number"
 * beside chips that have one reads as missing data rather than an empty
 * bucket. Null is reserved for "the counts have not arrived yet".
 */
function countOf(counts: Record<string, number> | undefined, key: string): number | null {
  return counts ? (counts[key] ?? 0) : null;
}
