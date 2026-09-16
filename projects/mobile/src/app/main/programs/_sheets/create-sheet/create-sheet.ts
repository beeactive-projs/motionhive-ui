import { Component, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { CREATE_OPTIONS, CreateChoice } from '../../programs.config';

/**
 * The one place anything gets created in the library.
 *
 * Three verbs behind a single button rather than three competing controls in
 * the header — see `CREATE_OPTIONS`. The choice is handed back only once the
 * sheet has actually gone: the parent navigates on it, and navigating while
 * Ionic is still animating the dismissal tears the page down under the modal
 * and leaves the sheet stranded on screen over the new page.
 */
@Component({
  selector: 'mh-create-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './create-sheet.html',
  styleUrl: './create-sheet.scss',
})
export class CreateSheet {
  readonly open = model(false);

  readonly choose = output<CreateChoice>();

  readonly options = CREATE_OPTIONS;

  /** The choice waits here until the sheet has actually gone. */
  private _pending: CreateChoice | null = null;

  pick(id: CreateChoice): void {
    this._pending = id;
    this.open.set(false);
  }

  onDismissed(): void {
    const choice = this._pending;
    this._pending = null;
    if (choice) this.choose.emit(choice);
  }
}
