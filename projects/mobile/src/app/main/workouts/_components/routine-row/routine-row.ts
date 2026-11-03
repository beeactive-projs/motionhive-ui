import { Component, computed, inject, input, output } from '@angular/core';
import {
  IonBadge,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Routine } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { emitAndClose } from '../../../../_shared/utils/swipe';
import { levelLabel, levelTone } from '../../../exercises/exercises.config';
import { RoutineSwipe, RoutineSwipes, lastDoneLabel } from '../../workouts.config';

/**
 * One routine — your own or a MotionHive starter: hexagon tile, name, then
 * "6 exercises · last done Tuesday", and where the catalogue wants it, the
 * editorial level. The row opens the routine.
 *
 * Your own routines also swipe left (`swipe`), as a conversation does: on
 * the Workouts page to reveal More and Edit, in the archive to Unarchive. The
 * row only emits; the page owns the sheets and the requests.
 */
@Component({
  selector: 'mh-routine-row',
  imports: [
    HexAvatar,
    IonBadge,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    TranslatePipe,
  ],
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
  /** What a swipe left offers; none, the row does not swipe. */
  readonly swipe = input<RoutineSwipe | null>(null);

  readonly select = output<void>();
  readonly edit = output<void>();
  readonly more = output<void>();
  readonly unarchive = output<void>();

  readonly Swipes = RoutineSwipes;

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
  readonly emitAndClose = emitAndClose;
}
