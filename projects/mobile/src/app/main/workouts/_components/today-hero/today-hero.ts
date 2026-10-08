import { Component, computed, inject, input, output } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TrainingDayWorkout, localDayKey } from 'core';

import {
  HeroStates,
  compactPrescription,
  heroState,
  planPositionLabel,
  shortDayLabel,
  workoutMetaLine,
} from '../../workouts.config';

/** Enough of the session to recognise it; the preview has the rest. */
const EXERCISE_PREVIEW_LIMIT = 3;

/**
 * Today's prescribed workout, as the front door's headline.
 *
 * Doubles as the "up next" card on a rest day — same shape, different
 * label, because a trainee between sessions still wants to see what is
 * coming rather than an empty slot.
 *
 * The action follows the day's state: start it, look at it while another
 * session is open, or see the summary once it is done.
 */
@Component({
  selector: 'mh-today-hero',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    TranslatePipe,
  ],
  templateUrl: './today-hero.html',
  styleUrl: './today-hero.scss',
  // The date label sits above the card the way every section label does.
  host: { class: 'mh-section' },
})
export class TodayHero {
  private readonly _translateService = inject(TranslateService);

  readonly workout = input.required<TrainingDayWorkout>();
  /** False when this is the next scheduled day rather than today's. */
  readonly isToday = input(true);
  /** Another workout is open, so this one can be looked at but not started. */
  readonly blocked = input(false);

  /** Opens the day's preview, where it is started. */
  readonly open = output<void>();
  /** Opens the finished day's summary. */
  readonly summary = output<void>();

  readonly States = HeroStates;

  readonly state = computed(() => heroState(this.workout(), this.blocked()));

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

  readonly meta = computed(() => {
    const workout = this.workout();
    return workoutMetaLine(workout.exercises?.length ?? null, workout.estimatedDurationMinutes);
  });

  readonly exercises = computed(() =>
    (this.workout().exercises ?? []).slice(0, EXERCISE_PREVIEW_LIMIT).map((exercise) => ({
      key: exercise.id,
      name: exercise.exercise?.name ?? this._translateService.instant('workouts.common.exercise'),
      prescription: compactPrescription(exercise.sets ?? []),
    })),
  );

  readonly moreCount = computed(() =>
    Math.max(0, (this.workout().exercises?.length ?? 0) - EXERCISE_PREVIEW_LIMIT),
  );
}
