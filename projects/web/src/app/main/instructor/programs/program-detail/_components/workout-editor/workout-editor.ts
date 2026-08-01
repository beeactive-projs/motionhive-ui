import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { PrescribedExercise, PrescribedSet, ProgramWorkout } from 'core';

import { ListEmptyState } from '../../../../../../_shared/components/list-empty-state/list-empty-state';
import { estimateWorkoutMinutes, workoutSetCount } from '../builder.utils';
import { ExerciseRow } from '../exercise-row/exercise-row';

/**
 * Right pane of the program builder — exactly one workout being edited.
 * Presentational: owns only the per-exercise expansion state (session-only);
 * every mutation is relayed to the container as an output.
 */
@Component({
  selector: 'mh-workout-editor',
  imports: [TitleCasePipe, Button, Chip, Tag, Tooltip, ExerciseRow, ListEmptyState],
  templateUrl: './workout-editor.html',
  styleUrl: './workout-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutEditor {
  readonly workout = input.required<ProgramWorkout>();
  /** 1-based week number for the eyebrow. */
  readonly weekNumber = input.required<number>();
  readonly indexInWeek = input.required<number>();
  readonly weekWorkoutCount = input.required<number>();
  readonly canMoveExerciseAcross = input(false);
  /** Mobile one-pane mode — show a back control to the outline. */
  readonly showBack = input(false);

  readonly back = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly moveToWeek = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly addExercise = output<void>();
  readonly reorderExercise = output<{ from: number; to: number }>();
  readonly moveExerciseTo = output<PrescribedExercise>();
  readonly removeExercise = output<PrescribedExercise>();
  readonly addSet = output<PrescribedExercise>();
  readonly editSet = output<{ exercise: PrescribedExercise; set: PrescribedSet }>();
  readonly duplicateSet = output<{ exercise: PrescribedExercise; set: PrescribedSet }>();
  readonly removeSet = output<{ exercise: PrescribedExercise; set: PrescribedSet }>();
  readonly setsReordered = output<{ exercise: PrescribedExercise; sets: PrescribedSet[] }>();

  // Session-only expansion, default collapsed — the prescription line makes
  // rows self-describing. Ids are globally unique, so the set survives
  // switching between workouts.
  private readonly _expandedExercises = signal<ReadonlySet<string>>(new Set());

  readonly exercises = computed(() => this.workout().exercises ?? []);
  readonly setCount = computed(() => workoutSetCount(this.workout()));
  readonly durationEstimate = computed(() => estimateWorkoutMinutes(this.workout()));

  isExpanded(id: string): boolean {
    return this._expandedExercises().has(id);
  }

  toggleExercise(id: string): void {
    this._expandedExercises.update((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
}
