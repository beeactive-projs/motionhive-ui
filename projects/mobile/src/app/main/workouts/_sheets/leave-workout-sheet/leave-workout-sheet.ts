import { Component, model, output, viewChild } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { LEAVE_OPTIONS, LeaveChoice } from '../../workouts.config';

/**
 * Asked on the way out of the logger: keep the clock running, or pause it.
 * Either way the workout stays open and waits on the Workouts tab.
 *
 * Both answers navigate, so the choice is emitted only once the sheet has
 * actually gone — a sheet still animating out when the page changes is left
 * presented over the next one.
 */
@Component({
  selector: 'mh-leave-workout-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell, TranslatePipe],
  templateUrl: './leave-workout-sheet.html',
  styleUrl: './leave-workout-sheet.scss',
})
export class LeaveWorkoutSheet {
  readonly open = model(false);

  readonly choice = output<LeaveChoice>();

  readonly options = LEAVE_OPTIONS;

  private readonly _sheetShell = viewChild(SheetShell);

  async choose(id: LeaveChoice): Promise<void> {
    await this._sheetShell()?.close();
    this.choice.emit(id);
  }
}
