import { Component, computed, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { LoggedExercise } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

export type ExerciseActionId = 'swap' | 'skip' | 'remove';

/**
 * The verbs for one exercise mid-workout.
 *
 * Uses the app's own sheet chrome rather than `ion-action-sheet`: the design
 * language specifies the grabber, the Poppins title and the row treatment,
 * and an Ionic default sheet matches none of them.
 */
@Component({
  selector: 'mh-exercise-actions-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './exercise-actions-sheet.html',
  styleUrl: './exercise-actions-sheet.scss',
})
export class ExerciseActionsSheet {
  readonly open = model(false);
  readonly exercise = input<LoggedExercise | null>(null);

  readonly action = output<ExerciseActionId>();

  readonly name = computed(() => this.exercise()?.exerciseNameSnapshot ?? '');

  readonly actions = computed(() => {
    const skipped = this.exercise()?.isSkipped ?? false;
    return [
      { id: 'swap' as const, label: 'Swap exercise', icon: 'repeat-outline', destructive: false },
      {
        id: 'skip' as const,
        label: skipped ? 'Unskip exercise' : 'Skip exercise',
        icon: 'play-skip-forward-outline',
        destructive: false,
      },
      {
        id: 'remove' as const,
        label: 'Remove from workout',
        icon: 'trash-outline',
        destructive: true,
      },
    ];
  });

  choose(id: ExerciseActionId): void {
    this.open.set(false);
    this.action.emit(id);
  }
}
