import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';

import { Routine, dayDividerLabel, localDayKey } from 'core';

/**
 * One saved routine: the shared session-row geometry with the spine keyed to
 * position rather than to a category, since a routine has none. The trailing
 * column is a play affordance — a routine's whole purpose is to be started.
 */
@Component({
  selector: 'mh-routine-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel],
  templateUrl: './routine-row.html',
  styleUrl: './routine-row.scss',
})
export class RoutineRow {
  readonly routine = input.required<Routine>();
  /** Spine colour, rotated by list position — see `routineTone`. */
  readonly tone = input('honey');
  /** Starters are runnable by anyone and owned by nobody. */
  readonly starter = input(false);

  readonly select = output<void>();
  readonly start = output<void>();

  readonly exerciseCount = computed(() => {
    const n = this.routine().exerciseCount;
    return `${n} ${n === 1 ? 'exercise' : 'exercises'}`;
  });

  /**
   * "Last done Tuesday" — the one fact that sorts a library in a user's head.
   * Absent on a routine never performed, where silence beats "Never".
   */
  readonly lastDone = computed(() => {
    const at = this.routine().lastPerformedAt;
    return at ? `Last done ${dayDividerLabel(localDayKey(new Date(at)))}` : '';
  });
}
