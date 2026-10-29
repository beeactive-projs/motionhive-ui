import { Component, computed, input, output } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ProfileWorkout, translate } from 'core';

import { SpineTones } from '../../../../_shared/models/spine-tone.model';
import { workoutSummaryLine } from '../../../../_shared/utils/workout-summary';
import { BadgeTones } from '../../../exercises/exercises.config';
import { dateRail } from '../../../workouts/workouts.config';

/**
 * A workout on someone's profile, as the history row draws one: the day on
 * the rail, the name, what it amounted to and the person's own words. Only
 * the safe summary, never a note or a weight. A record turns the spine and
 * a badge honey, the one thing on the row worth celebrating. The row opens
 * the workout's own page.
 */
@Component({
  selector: 'mh-profile-workout-row',
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './profile-workout-row.html',
  styleUrl: './profile-workout-row.scss',
})
export class ProfileWorkoutRow {
  readonly workout = input.required<ProfileWorkout>();
  /** Offers the ⋯ menu. Off on your own profile: nothing to report. */
  readonly withMenu = input(false);

  readonly select = output<void>();
  readonly menu = output<void>();

  readonly rail = computed(() => {
    const at = this.workout().completedAt;
    return at ? dateRail(at) : null;
  });

  readonly tone = computed(() =>
    this.workout().recordCount > 0 ? SpineTones.Honey : SpineTones.Booked,
  );

  readonly meta = computed(() => workoutSummaryLine(this.workout(), { withRecords: false }));

  onMenu(event: Event): void {
    // Inside the row's own tap target; without this the menu also opens the workout.
    event.stopPropagation();
    this.menu.emit();
  }

  readonly records = computed(() => {
    const count = this.workout().recordCount;
    return count > 0
      ? { label: translate('person.workouts.records', { count }), tone: BadgeTones.Honey }
      : null;
  });
}
