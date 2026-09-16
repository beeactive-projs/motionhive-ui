import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { AssignedWorkout, WorkoutLogStatus } from 'core';

import { assignedDayTone, dateRail, workoutMetaLine } from '../../workouts.config';

/**
 * One planned day of a program, as the trainee's plan page lists them: the
 * date rail, the day's name, and how it stands — a tick once it is done, a
 * quiet chip once it was skipped, a chevron while it is still ahead.
 *
 * Today's row grows a Start pill in place of the chevron, the way a live
 * booking row grows Join: the one row you are meant to act on says so, and
 * the rest stay rows.
 */
@Component({
  selector: 'mh-assigned-day-row',
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './assigned-day-row.html',
  styleUrl: './assigned-day-row.scss',
})
export class AssignedDayRow {
  readonly day = input.required<AssignedWorkout>();
  /** This is the day to do now — show Start rather than a chevron. */
  readonly startable = input(false);

  readonly select = output<void>();
  readonly start = output<void>();

  readonly tone = computed(() => assignedDayTone(this.day()));

  readonly rail = computed(() => dateRail(this.day().scheduledDate));

  readonly isDone = computed(() => this.day().status === WorkoutLogStatus.Completed);

  readonly isSkipped = computed(() => this.day().status === WorkoutLogStatus.Skipped);

  readonly meta = computed(() => {
    const day = this.day();
    return workoutMetaLine(day.exercises?.length ?? null, day.estimatedDurationMinutes);
  });

  onStart(event: Event): void {
    // Inside the row's own tap target; without this Start also opens the preview.
    event.stopPropagation();
    this.start.emit();
  }
}
