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

/**
 * Left rail of the program builder — the persistent program outline
 * (weeks → workouts) with search. Presentational: collapse state and
 * selection are owned by the container; only the search query lives here.
 */
@Component({
  selector: 'mh-builder-rail',
  imports: [FormsModule, Button, ButtonDirective, IconField, InputIcon, InputText, Tag, Tooltip],
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
