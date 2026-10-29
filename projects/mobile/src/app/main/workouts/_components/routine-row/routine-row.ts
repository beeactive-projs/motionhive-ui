import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonButton, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Routine } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { levelLabel, levelTone } from '../../../exercises/exercises.config';
import { lastDoneLabel } from '../../workouts.config';

/**
 * One routine in a grouped card — your own or a MotionHive starter: hexagon
 * tile, name, then "6 exercises · last done Tuesday", and where the catalogue
 * wants it, the editorial level.
 *
 * The row opens the routine. Your own routines on the Workouts page also
 * carry Start (`startable`), the design's quickest way to train: a labelled
 * outline button of its own at the end, so it is never a hidden half of the
 * row, the confusion that once kept it off. The catalogue's rows stay
 * open-only.
 */
@Component({
  selector: 'mh-routine-row',
  imports: [HexAvatar, IonBadge, IonButton, IonItem, IonLabel, TranslatePipe],
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
  /** Offers Start at the end of the row instead of the chevron. */
  readonly startable = input(false);
  /** This one is starting: its Start waits. */
  readonly starting = input(false);

  readonly select = output<void>();
  readonly start = output<void>();

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

  onStart(event: Event): void {
    // Inside the row's own tap target; without this Start also opens it.
    event.stopPropagation();
    this.start.emit();
  }
}
