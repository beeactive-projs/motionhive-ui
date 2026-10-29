import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { WorkoutLog, WorkoutLogStatus, translate } from 'core';

import { BadgeTones } from '../../../exercises/exercises.config';
import { LogSources, dateRail, logChip, logMeta, logSource, logTone } from '../../workouts.config';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, refreshOutline } from 'ionicons/icons';

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
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './log-row.html',
  styleUrl: './log-row.scss',
})
export class LogRow {
  readonly log = input.required<WorkoutLog>();
  /** Offers the Repeat control. Off where the reader is not the one training. */
  readonly repeatable = input(false);
  /** Names the coach on assigned work. Off where the reader is the coach. */
  readonly showSource = input(false);

  readonly select = output<void>();
  readonly repeat = output<void>();

  readonly tone = computed(() => logTone(this.log()));

  /** A skipped plan day is a record of a choice, with no log behind it to open. */
  readonly openable = computed(() => this.log().status !== WorkoutLogStatus.Skipped);

  readonly rail = computed(() => dateRail(this.log().startedAt));

  readonly meta = computed(() => logMeta(this.log()));

  readonly chip = computed(() => logChip(this.log()));

  /** "1 record": beating a previous best, the one thing a row celebrates. */
  readonly records = computed(() => {
    const count = this.log().prCount ?? 0;
    return count > 0
      ? { label: translate('workouts.logRow.records', { count }), tone: BadgeTones.Honey }
      : null;
  });

  readonly sourceChip = computed(() =>
    this.showSource() && logSource(this.log()) === LogSources.Coach
      ? { label: translate('workouts.logRow.coach'), tone: BadgeTones.Navy }
      : null,
  );

  constructor() {
    // Its own glyphs: the row sits on pages that register others.
    addIcons({ chevronForwardOutline, refreshOutline });
  }

  onSelect(): void {
    if (this.openable()) this.select.emit();
  }

  onRepeat(event: Event): void {
    // Inside the row's own tap target; without this Repeat also opens the log.
    event.stopPropagation();
    this.repeat.emit();
  }
}
