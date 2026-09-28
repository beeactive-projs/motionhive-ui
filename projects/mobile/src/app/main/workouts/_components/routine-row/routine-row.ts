import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Routine, dayDividerLabel, localDayKey } from 'core';

import { SpineTone, SpineTones } from '../../../../_shared/models/spine-tone.model';

/**
 * One saved routine: the shared session-row geometry with the spine keyed to
 * position rather than to a category, since a routine has none.
 *
 * The row opens the routine; it does not start it. Starting lives on the
 * routine's own page, next to the exercise list — a second tap target on the
 * row itself only made it unclear which half you had pressed.
 */
@Component({
  selector: 'mh-routine-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './routine-row.html',
  styleUrl: './routine-row.scss',
})
export class RoutineRow {
  private readonly _translateService = inject(TranslateService);

  readonly routine = input.required<Routine>();
  /** Spine colour, rotated by list position — see `routineTone`. */
  readonly tone = input<SpineTone>(SpineTones.Honey);
  /** Starters are runnable by anyone and owned by nobody. */
  readonly starter = input(false);

  readonly select = output<void>();

  readonly exerciseCount = computed(() =>
    this._translateService.instant('count.exercises', { count: this.routine().exerciseCount }),
  );

  /**
   * "Last done Tuesday" — the one fact that sorts a library in a user's head.
   * Absent on a routine never performed, where silence beats "Never".
   */
  readonly lastDone = computed(() => {
    const at = this.routine().lastPerformedAt;
    return at
      ? this._translateService.instant('workouts.routineRow.lastDone', {
          day: dayDividerLabel(localDayKey(new Date(at))),
        })
      : '';
  });
}
