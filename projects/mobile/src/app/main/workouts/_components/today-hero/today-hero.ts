import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

import { TrainingDayWorkout } from 'core';

import { planPositionLabel, workoutMetaLine } from '../../workouts.config';

/** How many exercises the hero names before folding the rest into "+ n more". */
const INLINE_EXERCISES = 3;

/**
 * Today's prescribed workout, as the front door's headline.
 *
 * Doubles as the "up next" card on a rest day — same shape, different
 * eyebrow, because a trainee between sessions still wants to see what is
 * coming rather than an empty slot.
 */
@Component({
  selector: 'mh-today-hero',
  imports: [IonButton, IonIcon],
  templateUrl: './today-hero.html',
  styleUrl: './today-hero.scss',
})
export class TodayHero {
  readonly workout = input.required<TrainingDayWorkout>();
  /** False when this is the next scheduled day rather than today's. */
  readonly isToday = input(true);
  /** Names of the first few exercises, when the caller has the tree. */
  readonly exercises = input<readonly string[]>([]);

  readonly start = output<void>();

  readonly eyebrow = computed(() => {
    if (!this.isToday()) {
      const date = this.workout().scheduledDate;
      return date ? `UP NEXT · ${this._dayLabel(date)}` : 'UP NEXT';
    }
    return `TODAY · ${this._dayLabel(new Date().toISOString().slice(0, 10))}`;
  });

  readonly position = computed(() => {
    const w = this.workout();
    return planPositionLabel(w.planName, w.weekIndex, w.dayIndex);
  });

  readonly meta = computed(() =>
    workoutMetaLine(
      this.exercises().length || null,
      this.workout().estimatedDurationMinutes,
    ),
  );

  readonly inlineExercises = computed(() => this.exercises().slice(0, INLINE_EXERCISES));

  readonly moreCount = computed(() => Math.max(0, this.exercises().length - INLINE_EXERCISES));

  private _dayLabel(isoDate: string): string {
    // Parsed as local midnight: a date-only string is a calendar day, and
    // `new Date('2026-09-12')` would read it as UTC and slip a day west of
    // Greenwich.
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
      .toUpperCase();
  }
}
