import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPreview,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { ProgramWorkout } from 'core';

import {
  WeekGroup,
  estimateWorkoutMinutes,
  workoutExerciseCount,
  workoutSetCount,
} from '../builder.utils';

/** A workout dropped in the rail — same-week reorder or cross-week move. */
export interface RailWorkoutDrop {
  workoutId: string;
  fromWeek: number;
  toWeek: number;
  /** Index in the source week's day-sorted list. */
  fromIndex: number;
  /** Drop position in the target week's day-sorted list. */
  toIndex: number;
}

/** A week section dropped at a new position in the rail. */
export interface RailWeekDrop {
  fromIndex: number;
  toIndex: number;
}

/**
 * Left rail of the program builder — the persistent program outline
 * (weeks → workouts) with search. Presentational: collapse state and
 * selection are owned by the container; only the search query lives here.
 *
 * Drag & drop is two isolated CDK systems: an outer drop list for week
 * sections (grip-handle only, connected to nothing) and per-week inner
 * drop lists for workouts connected to each other by id — never both
 * active at once, so nested-list hit-testing can't fight itself.
 */
@Component({
  selector: 'mh-builder-rail',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
    CdkDropList,
    CdkScrollable,
    FormsModule,
    Button,
    ButtonDirective,
    IconField,
    InputIcon,
    InputText,
    Tag,
    Tooltip,
  ],
  templateUrl: './builder-rail.html',
  styleUrl: './builder-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderRail {
  /** All weeks, including empty ones (derived from program duration). */
  readonly weeks = input.required<WeekGroup[]>();
  readonly selectedWorkoutId = input<string | null>(null);
  readonly collapsedWeeks = input.required<ReadonlySet<number>>();
  readonly totalWorkouts = input.required<number>();

  readonly selectWorkout = output<string>();
  readonly toggleWeek = output<number>();
  /** Week index to add into; null = "in another week" (week picked in the dialog). */
  readonly addWorkout = output<number | null>();
  readonly workoutDropped = output<RailWorkoutDrop>();
  readonly weekDropped = output<RailWeekDrop>();

  readonly searchQuery = signal('');
  private readonly _normalizedQuery = computed(() => this.searchQuery().trim().toLowerCase());
  readonly searchActive = computed(() => this._normalizedQuery().length > 0);

  /**
   * Weeks to render. While searching: only workouts whose name or any
   * exercise name matches, weeks with no matches (incl. empty weeks)
   * dropped. Otherwise the input verbatim.
   */
  readonly visibleWeeks = computed<WeekGroup[]>(() => {
    const q = this._normalizedQuery();
    if (!q) return this.weeks();
    return this.weeks()
      .map((g) => ({ ...g, workouts: g.workouts.filter((w) => this._matches(w, q)) }))
      .filter((g) => g.workouts.length > 0);
  });

  // ── Drag & drop ──────────────────────────────────────────────────

  /** True while a workout row is being dragged — drives collapsed-week drop strips. */
  readonly workoutDragActive = signal(false);
  /** Source week of the in-flight workout drag — full-week muting skips it. */
  readonly dragSourceWeek = signal<number | null>(null);

  /** Ids of every week's inner drop list — cross-week connections. */
  readonly workoutListIds = computed(() => this.weeks().map((g) => `mh-rail-wolist-${g.week}`));

  /** Touch holds briefly before a drag so scrolling isn't hijacked; instant on mouse. */
  protected readonly dragStartDelay = { touch: 200, mouse: 0 };

  /**
   * Foreign workouts may only enter weeks with a free day slot (7 max —
   * one per day). Arrow property so CDK gets a stable, `this`-free ref;
   * re-entering the origin list bypasses the predicate by design.
   */
  readonly canEnterWeek = (_drag: CdkDrag<ProgramWorkout>, drop: CdkDropList<WeekGroup>): boolean =>
    drop.data.workouts.length < 7;

  onWorkoutDragStarted(week: number): void {
    this.workoutDragActive.set(true);
    this.dragSourceWeek.set(week);
  }

  onWorkoutDragEnded(): void {
    this.workoutDragActive.set(false);
    this.dragSourceWeek.set(null);
  }

  onWorkoutDrop(e: CdkDragDrop<WeekGroup, WeekGroup, ProgramWorkout>): void {
    if (this.searchActive()) return; // defensive — lists are disabled while searching
    const from = e.previousContainer.data;
    const to = e.container.data;
    if (from.week === to.week && e.previousIndex === e.currentIndex) return;
    // A collapsed target renders no rows, so currentIndex is meaningless — append.
    const collapsedTarget = from.week !== to.week && !this.isWeekOpen(to.week);
    this.workoutDropped.emit({
      workoutId: e.item.data.id,
      fromWeek: from.week,
      toWeek: to.week,
      fromIndex: e.previousIndex,
      toIndex: collapsedTarget ? to.workouts.length : e.currentIndex,
    });
  }

  onWeekDrop(e: CdkDragDrop<WeekGroup[]>): void {
    if (this.searchActive() || e.previousIndex === e.currentIndex) return;
    this.weekDropped.emit({ fromIndex: e.previousIndex, toIndex: e.currentIndex });
  }

  /** Search overrides collapse view-only — persisted state is untouched. */
  isWeekOpen(week: number): boolean {
    return this.searchActive() || !this.collapsedWeeks().has(week);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  workoutMeta(w: ProgramWorkout): string {
    const sets = workoutSetCount(w);
    const minutes = estimateWorkoutMinutes(w);
    const parts = [`${workoutExerciseCount(w)} ex`, `${sets} ${sets === 1 ? 'set' : 'sets'}`];
    if (minutes != null) parts.push(`~${minutes}m`);
    return parts.join(' · ');
  }

  private _matches(w: ProgramWorkout, q: string): boolean {
    if (w.name.toLowerCase().includes(q)) return true;
    return (w.exercises ?? []).some((e) => e.exercise?.name?.toLowerCase().includes(q));
  }
}
