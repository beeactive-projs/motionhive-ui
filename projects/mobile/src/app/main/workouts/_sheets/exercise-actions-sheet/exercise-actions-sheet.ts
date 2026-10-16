import { Component, computed, input, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LoggedExercise } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ExerciseActionId, exerciseActions } from '../../workouts.config';

/**
 * The verbs for one exercise mid-workout, under the exercise's name. The
 * verbs themselves are declared in `workouts.config` beside the icons they draw.
 */
@Component({
  selector: 'mh-exercise-actions-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './exercise-actions-sheet.html',
})
export class ExerciseActionsSheet {
  readonly open = model(false);
  readonly exercise = input<LoggedExercise | null>(null);

  readonly action = output<ExerciseActionId>();

  readonly name = computed(() => this.exercise()?.exerciseNameSnapshot ?? '');

  readonly actions = computed(() => exerciseActions(this.exercise()?.isSkipped ?? false));
}
