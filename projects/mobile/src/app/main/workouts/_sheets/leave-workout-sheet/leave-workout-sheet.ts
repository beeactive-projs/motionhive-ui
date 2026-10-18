import { Component, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { LEAVE_OPTIONS, LeaveChoice } from '../../workouts.config';

/**
 * Asked on the way out of the logger: keep the clock running, or pause it.
 * Either way the workout stays open and waits on the Workouts tab.
 *
 * Both answers navigate, which is safe because the action sheet only reports
 * the choice once it has actually gone.
 */
@Component({
  selector: 'mh-leave-workout-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './leave-workout-sheet.html',
})
export class LeaveWorkoutSheet {
  readonly open = model(false);

  readonly choice = output<LeaveChoice>();

  readonly options = LEAVE_OPTIONS;
}
