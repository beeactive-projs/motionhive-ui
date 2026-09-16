import { Component, computed, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { LoggedExercise } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { ExerciseActionId, exerciseActions } from '../../workouts.config';

/**
 * The verbs for one exercise mid-workout.
 *
 * Uses the app's own sheet chrome rather than `ion-action-sheet`: the design
 * language specifies the grabber, the Poppins title and the row treatment,
 * and an Ionic default sheet matches none of them. The verbs themselves are
 * declared in `workouts.config` beside the icons they draw.
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

  readonly actions = computed(() => exerciseActions(this.exercise()?.isSkipped ?? false));

  choose(id: ExerciseActionId): void {
    this.open.set(false);
    this.action.emit(id);
  }
}
