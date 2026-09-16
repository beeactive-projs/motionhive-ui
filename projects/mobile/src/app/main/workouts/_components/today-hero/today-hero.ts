import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';

import { TrainingDayWorkout, localDayKey } from 'core';

import { planPositionLabel, shortDayLabel, workoutMetaLine } from '../../workouts.config';

/**
 * Today's prescribed workout, as the front door's headline.
 *
 * Doubles as the "up next" card on a rest day — same shape, different
 * eyebrow, because a trainee between sessions still wants to see what is
 * coming rather than an empty slot.
 */
@Component({
  selector: 'mh-today-hero',
  imports: [IonButton, IonCard, IonCardContent, IonIcon],
  templateUrl: './today-hero.html',
  styleUrl: './today-hero.scss',
})
export class TodayHero {
  readonly workout = input.required<TrainingDayWorkout>();
  /** False when this is the next scheduled day rather than today's. */
  readonly isToday = input(true);

  readonly start = output<void>();

  readonly eyebrow = computed(() => {
    if (this.isToday()) return `Today · ${shortDayLabel(localDayKey(new Date()))}`;
    const date = this.workout().scheduledDate;
    return date ? `Up next · ${shortDayLabel(date)}` : 'Up next';
  });

  readonly position = computed(() => {
    const workout = this.workout();
    return planPositionLabel(workout.planName, workout.weekIndex, workout.dayIndex);
  });

  readonly meta = computed(() => workoutMetaLine(null, this.workout().estimatedDurationMinutes));
}
