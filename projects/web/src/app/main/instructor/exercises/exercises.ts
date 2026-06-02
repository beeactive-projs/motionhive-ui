import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  Exercise,
  ExerciseFacets,
  ExerciseKind,
  ExerciseLevel,
  ExerciseOwnershipFilter,
  ExerciseService,
  ExerciseSortKey,
  ExerciseTaxonomyStore,
  ListExercisesQuery,
  showApiError,
} from 'core';

import { ExerciseCard } from './exercise-card/exercise-card';
import { ExerciseDetailDialog } from './exercise-detail-dialog/exercise-detail-dialog';
import { ExerciseFilterPanel } from './exercise-filter-panel/exercise-filter-panel';
import { ExerciseFormDialog } from './exercise-form-dialog/exercise-form-dialog';

/**
 * Exercises Catalog (S1).
 *
 * Instructor-facing — clients land here only when their browse-gate
 * (server-side §19) allows it; the BE returns 403 otherwise. We don't
 * defensively gate on the FE; the messages it produces are already
 * actionable.
 *
 * Pagination is server-side (PrimeNG-compatible shape). For V1 we
 * surface a "Load more" button instead of intersection-observer
 * infinite scroll — same data flow, less JS state to manage.
 */
@Component({
  selector: 'mh-exercises',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    Drawer,
    InputTextModule,
    Menu,
    Toast,
    TooltipModule,
    ExerciseCard,
    ExerciseDetailDialog,
    ExerciseFilterPanel,
    ExerciseFormDialog,
  ],
  providers: [MessageService],
  templateUrl: './exercises.html',
  styleUrl: './exercises.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Exercises {
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);
  readonly taxonomy = inject(ExerciseTaxonomyStore);

  // ── State ────────────────────────────────────────────────────────

  readonly items = signal<Exercise[]>([]);
  readonly total = signal(0);
  readonly facets = signal<ExerciseFacets | undefined>(undefined);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 24;

  // Filters / search (signals so we can trigger refetch via effect)
  // `search` is the committed value the fetch effect reacts to;
  // `searchInput` is the raw input (debounced into `search` to avoid
  // a request per keystroke).
  readonly search = signal('');
  readonly searchInput = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;
  readonly ownership = signal<ExerciseOwnershipFilter>(
    ExerciseOwnershipFilter.All,
  );
  readonly sort = signal<ExerciseSortKey>(ExerciseSortKey.Name);
  readonly selectedKinds = signal<Set<ExerciseKind>>(new Set());
  readonly selectedLevels = signal<Set<ExerciseLevel>>(new Set());
  readonly selectedMuscleIds = signal<Set<string>>(new Set());
  readonly selectedEquipmentIds = signal<Set<string>>(new Set());

  // Detail dialog
  readonly detailVisible = signal(false);
  readonly detailExerciseId = signal<string | null>(null);

  // Form dialog (create + edit)
  readonly formVisible = signal(false);
  readonly formExercise = signal<Exercise | null>(null);

  // Mobile filter drawer
  readonly filterDrawerVisible = signal(false);

  // ── Derived ──────────────────────────────────────────────────────

  readonly hasMore = computed(() => this.items().length < this.total());

  /** Responsive CTA label — short on phones to stop the header from wrapping. */
  readonly viewportWidth = signal(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );
  readonly createLabel = computed(() =>
    this.viewportWidth() < 600 ? 'Create' : 'Create custom exercise',
  );

  readonly activeFilterCount = computed(() => {
    return (
      this.selectedKinds().size +
      this.selectedLevels().size +
      this.selectedMuscleIds().size +
      this.selectedEquipmentIds().size +
      (this.search() ? 1 : 0)
    );
  });

  readonly ownershipTabs: { value: ExerciseOwnershipFilter; label: string }[] =
    [
      { value: ExerciseOwnershipFilter.All, label: 'All' },
      { value: ExerciseOwnershipFilter.System, label: 'System' },
      { value: ExerciseOwnershipFilter.Mine, label: 'My exercises' },
      {
        value: ExerciseOwnershipFilter.PublicOthers,
        label: 'Public · others',
      },
    ];

  readonly kindOptions: { value: ExerciseKind; label: string }[] = [
    { value: ExerciseKind.Strength, label: 'Strength' },
    { value: ExerciseKind.Cardio, label: 'Cardio' },
    { value: ExerciseKind.Bodyweight, label: 'Bodyweight' },
    { value: ExerciseKind.Mobility, label: 'Mobility' },
    { value: ExerciseKind.Duration, label: 'Duration' },
    { value: ExerciseKind.Distance, label: 'Distance' },
  ];

  readonly levelOptions: { value: ExerciseLevel; label: string }[] = [
    { value: ExerciseLevel.Beginner, label: 'Beginner' },
    { value: ExerciseLevel.Intermediate, label: 'Intermediate' },
    { value: ExerciseLevel.Advanced, label: 'Advanced' },
  ];

  readonly sortItems: MenuItem[] = [
    {
      label: 'Name (A–Z)',
      icon: 'pi pi-sort-alpha-down',
      command: () => this.setSort(ExerciseSortKey.Name),
    },
    {
      label: 'Newest first',
      icon: 'pi pi-clock',
      command: () => this.setSort(ExerciseSortKey.Newest),
    },
    {
      label: 'Most forked',
      icon: 'pi pi-share-alt',
      command: () => this.setSort(ExerciseSortKey.MostForked),
    },
  ];

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case ExerciseSortKey.Newest:
        return 'Newest';
      case ExerciseSortKey.MostForked:
        return 'Most forked';
      default:
        return 'Name';
    }
  });

  constructor() {
    this.taxonomy.ensureLoaded();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () =>
        this.viewportWidth.set(window.innerWidth),
      );
    }

    // Reset to page 1 + refetch whenever a filter changes.
    effect(() => {
      // Subscribe to all filter signals so the effect re-runs.
      this.search();
      this.ownership();
      this.sort();
      this.selectedKinds();
      this.selectedLevels();
      this.selectedMuscleIds();
      this.selectedEquipmentIds();
      this.page.set(1);
      this.fetch(true);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  setOwnership(value: ExerciseOwnershipFilter): void {
    this.ownership.set(value);
  }

  setSort(value: ExerciseSortKey): void {
    this.sort.set(value);
  }

  onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    // 300ms is the sweet spot for "I stopped typing" without feeling
    // laggy. The toolbar stays responsive (chip count is live) but the
    // server only hears the final value.
    this._searchTimer = setTimeout(() => {
      this.search.set(value.trim());
    }, 300);
  }

  toggleKind(value: ExerciseKind): void {
    this.selectedKinds.update((s) => toggleInSet(s, value));
  }

  toggleLevel(value: ExerciseLevel): void {
    this.selectedLevels.update((s) => toggleInSet(s, value));
  }

  toggleMuscle(id: string): void {
    this.selectedMuscleIds.update((s) => toggleInSet(s, id));
  }

  toggleEquipment(id: string): void {
    this.selectedEquipmentIds.update((s) => toggleInSet(s, id));
  }

  clearFilters(): void {
    this.search.set('');
    this.selectedKinds.set(new Set());
    this.selectedLevels.set(new Set());
    this.selectedMuscleIds.set(new Set());
    this.selectedEquipmentIds.set(new Set());
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  openDetail(exercise: Exercise): void {
    this.detailExerciseId.set(exercise.id);
    this.detailVisible.set(true);
  }

  openCreate(): void {
    this.formExercise.set(null);
    this.formVisible.set(true);
  }

  openEdit(exercise: Exercise): void {
    // Caller passes the already-loaded detail row so the form pre-fills
    // muscles + equipment without an extra fetch.
    this.formExercise.set(exercise);
    this.detailVisible.set(false);
    this.formVisible.set(true);
  }

  /** Bubbled up from form (create or edit). Refresh the list and ack. */
  onSaved(_exercise: Exercise): void {
    this.refresh();
  }

  /** Bubbled up from detail when the row was deleted or its
   *  visibility flipped — refresh to reflect the new state. */
  onMutated(): void {
    this.refresh();
  }

  /** Bubbled up from detail after a successful fork. Open the new fork's
   *  detail so the user lands on their freshly-cloned copy. */
  onForked(forkId: string): void {
    this.detailExerciseId.set(forkId);
    this.detailVisible.set(true);
    this.refresh();
  }

  private refresh(): void {
    this.page.set(1);
    this.fetch(true);
  }

  isMine(_exercise: Exercise): boolean {
    // Placeholder — we don't have the current user id wired into this
    // component yet. The BE already filters PRIVATE rows correctly per
    // user; on the catalog page, the ownership tab handles the "Mine"
    // slice. Future slice: thread `meId` and compute properly.
    return false;
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(replace: boolean): void {
    const query: ListExercisesQuery = {
      page: this.page(),
      limit: this.pageSize,
      search: this.search() || undefined,
      ownership: this.ownership(),
      sort: this.sort(),
      kind: this.selectedKinds().size
        ? Array.from(this.selectedKinds())
        : undefined,
      level: this.selectedLevels().size
        ? Array.from(this.selectedLevels())
        : undefined,
      primaryMuscleId: this.selectedMuscleIds().size
        ? Array.from(this.selectedMuscleIds())
        : undefined,
      equipmentId: this.selectedEquipmentIds().size
        ? Array.from(this.selectedEquipmentIds())
        : undefined,
      withFacets: replace, // facets only refresh on filter changes, not on Load More
    };

    if (replace) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    this._exerciseService.list(query).subscribe({
      next: (res) => {
        if (replace) {
          this.items.set(res.items);
          this.facets.set(res.facets);
        } else {
          this.items.update((cur) => [...cur, ...res.items]);
        }
        this.total.set(res.total);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't load exercises",
          'Check your connection and try again.',
          err,
        ),
      complete: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
