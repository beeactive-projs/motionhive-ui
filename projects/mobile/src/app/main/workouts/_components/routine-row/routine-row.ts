import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

import { Routine } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { levelLabel, levelTone } from '../../../exercises/exercises.config';
import { lastDoneLabel } from '../../workouts.config';

/**
 * One routine in a grouped card — your own or a MotionHive starter: hexagon
 * tile, name, then "6 exercises · last done Tuesday", and where the catalogue
 * wants it, the editorial level.
 *
 * The row opens the routine; it does not start it. Starting lives on the
 * routine's own page, next to the exercise list — a second tap target on the
 * row itself only made it unclear which half you had pressed.
 *
 * Draws its own divider for the same reason `mh-settings-row` does — Ionic's
 * inset list zeroes the border on `ion-item:only-child`, and every item here
 * is the only child of its host. Keep a list of these homogeneous.
 */
@Component({
  selector: 'mh-routine-row',
  imports: [HexAvatar, IonBadge, IonItem, IonLabel],
  templateUrl: './routine-row.html',
  styleUrl: './routine-row.scss',
})
export class RoutineRow {
  private readonly _translateService = inject(TranslateService);

  readonly routine = input.required<Routine>();
  /** Ionic palette name with a `-wash` step — see `routineTileColor`. */
  readonly color = input<string>('primary');
  /** The starter catalogue shows the level; elsewhere the chevron is enough. */
  readonly showLevel = input(false);
  readonly detail = input(true);

  readonly select = output<void>();

  /**
   * "6 exercises · last done Tuesday" — the last time is the one fact that
   * sorts a library in a user's head. Absent on a routine never performed,
   * where silence beats "Never".
   */
  readonly meta = computed(() => {
    const routine = this.routine();
    const parts = [
      this._translateService.instant('count.exercises', { count: routine.exerciseCount }),
    ];
    if (routine.lastPerformedAt) parts.push(lastDoneLabel(routine.lastPerformedAt, new Date()));
    return parts.join(' · ');
  });

  readonly level = computed(() => (this.showLevel() ? this.routine().level : null));

  readonly levelLabel = levelLabel;
  readonly levelTone = levelTone;
}
