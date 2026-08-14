import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';

import { PrescribedExercise, Program, ProgramWorkout } from 'core';

/** What the picker resolved to — the parent performs the actual move. */
export type MoveTargetChoice =
  | { kind: 'slot'; weekIndex: number; dayIndex: number }
  | { kind: 'workout'; workoutId: string };

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Cross-container "Move to…" picker for the program builder.
 *
 * Two modes, both dumb — the dialog only picks a target and emits it;
 * the parent owns the API calls and optimistic state:
 * - `workout`: choose a (week, day) slot for the source workout.
 *   Occupied slots are disabled locally; the BE still 409s on a race.
 * - `exercise`: choose a destination workout for the source exercise;
 *   it lands at the end of that workout.
 */
@Component({
  selector: 'mh-move-target-dialog',
  imports: [FormsModule, ButtonDirective, Dialog, Select],
  templateUrl: './move-target-dialog.html',
  styleUrl: './move-target-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveTargetDialog {
  readonly program = input.required<Program>();
  readonly mode = input.required<'workout' | 'exercise'>();
  /** Workout being moved (workout mode) / source workout (exercise mode). */
  readonly sourceWorkout = input.required<ProgramWorkout>();
  readonly exercise = input<PrescribedExercise | null>(null);
  readonly visible = model<boolean>(false);
  readonly chosen = output<MoveTargetChoice>();

  readonly targetWeek = signal<number>(0);
  readonly targetDay = signal<number>(0);
  readonly targetWorkoutId = signal<string | null>(null);

  readonly dialogHeader = computed(() =>
    this.mode() === 'workout' ? 'Move workout' : 'Move exercise',
  );

  readonly itemLabel = computed(() =>
    this.mode() === 'workout'
      ? this.sourceWorkout().name
      : (this.exercise()?.exercise?.name ?? 'Exercise'),
  );

  readonly weekOptions = computed<SelectItem<number>[]>(() => {
    const days = this.program().durationDays ?? 84; // 12 weeks default
    const dur = Math.max(1, Math.ceil(days / 7));
    return Array.from({ length: dur }, (_, i) => ({
      value: i,
      label: `Week ${i + 1}`,
    }));
  });

  /** Days of the chosen week; slots held by OTHER workouts are disabled. */
  readonly dayOptions = computed<SelectItem<number>[]>(() => {
    const week = this.targetWeek();
    const moving = this.sourceWorkout();
    const occupied = new Set(
      (this.program().workouts ?? [])
        .filter((w) => w.weekIndex === week && w.id !== moving.id)
        .map((w) => w.dayIndex),
    );
    return DAY_NAMES.map((label, day) => ({
      value: day,
      label,
      disabled: occupied.has(day),
    }));
  });

  /** Destination workouts (exercise mode) — everything but the source. */
  readonly workoutOptions = computed<SelectItem<string>[]>(() => {
    const source = this.sourceWorkout();
    return (this.program().workouts ?? [])
      .filter((w) => w.id !== source.id)
      .sort((a, b) => a.weekIndex - b.weekIndex || a.dayIndex - b.dayIndex)
      .map((w) => ({
        value: w.id,
        label: `Week ${w.weekIndex + 1} · ${DAY_NAMES[w.dayIndex]} — ${w.name}`,
      }));
  });

  readonly canSubmit = computed(() => {
    if (this.mode() === 'exercise') return this.targetWorkoutId() !== null;
    const w = this.sourceWorkout();
    const sameSlot =
      this.targetWeek() === w.weekIndex && this.targetDay() === w.dayIndex;
    const slotTaken = this.dayOptions().some(
      (d) => d.value === this.targetDay() && d.disabled,
    );
    return !sameSlot && !slotTaken;
  });

  constructor() {
    effect(() => {
      if (this.visible()) this._hydrate();
    });
  }

  cancel(): void {
    this.visible.set(false);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    if (this.mode() === 'workout') {
      this.chosen.emit({
        kind: 'slot',
        weekIndex: this.targetWeek(),
        dayIndex: this.targetDay(),
      });
    } else {
      const workoutId = this.targetWorkoutId();
      if (workoutId) this.chosen.emit({ kind: 'workout', workoutId });
    }
    this.visible.set(false);
  }

  private _hydrate(): void {
    const w = this.sourceWorkout();
    this.targetWeek.set(w.weekIndex);
    this.targetDay.set(w.dayIndex);
    this.targetWorkoutId.set(this.workoutOptions()[0]?.value ?? null);
  }
}
