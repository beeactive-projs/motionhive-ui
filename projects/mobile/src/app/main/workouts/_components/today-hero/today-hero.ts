import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
  imports: [IonButton, IonCard, IonCardContent, IonIcon, TranslatePipe],
  templateUrl: './today-hero.html',
  styleUrl: './today-hero.scss',
})
export class TodayHero {
  private readonly _translateService = inject(TranslateService);

  readonly workout = input.required<TrainingDayWorkout>();
  /** False when this is the next scheduled day rather than today's. */
  readonly isToday = input(true);

  readonly start = output<void>();

  readonly eyebrow = computed(() => {
    if (this.isToday()) {
      return this._translateService.instant('time.todayWithDate', {
        date: shortDayLabel(localDayKey(new Date())),
      });
    }
    const date = this.workout().scheduledDate;
    return date
      ? this._translateService.instant('workouts.todayHero.upNextWithDate', {
          date: shortDayLabel(date),
        })
      : this._translateService.instant('workouts.common.upNext');
  });

  readonly position = computed(() => {
    const workout = this.workout();
    return planPositionLabel(workout.planName, workout.weekIndex, workout.dayIndex);
  });

  readonly meta = computed(() => workoutMetaLine(null, this.workout().estimatedDurationMinutes));
}
