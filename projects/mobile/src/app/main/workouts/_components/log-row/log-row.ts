import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { WorkoutLog } from 'core';

import { dateRail, logChip, logMeta, logTone } from '../../workouts.config';

/**
 * One logged workout: a date rail on the left, the name and what the session
 * amounted to on the right, with the spine keyed to how it ended — emerald
 * done, muted skipped.
 *
 * The same row serves the trainee's own history and a coach reading a
 * client's training. Only the trainee gets Repeat: it starts a fresh
 * freestyle session carrying the same movements, and it rides the row rather
 * than hiding behind it because it is the fastest route to a second workout.
 */
@Component({
  selector: 'mh-log-row',
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './log-row.html',
  styleUrl: './log-row.scss',
})
export class LogRow {
  readonly log = input.required<WorkoutLog>();
  /** Offers the Repeat control. Off where the reader is not the one training. */
  readonly repeatable = input(false);

  readonly select = output<void>();
  readonly repeat = output<void>();

  readonly tone = computed(() => logTone(this.log()));

  readonly rail = computed(() => dateRail(this.log().startedAt));

  readonly meta = computed(() => logMeta(this.log()));

  readonly chip = computed(() => logChip(this.log()));

  onRepeat(event: Event): void {
    // Inside the row's own tap target; without this Repeat also opens the log.
    event.stopPropagation();
    this.repeat.emit();
  }
}
