import { Component, computed, input, model, output } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../sheet-shell/sheet-shell';
import { SheetAction } from './action-sheet.model';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * A list of verbs about one thing: the shell's header saying what it is
 * about, the verbs in rounded cards below, the destructive ones in a red card
 * of their own at the bottom, and a sheet exactly as tall as that.
 *
 * Built on the shell rather than `ActionSheetController` so it shares every
 * other sheet's chrome, and so verbs declared in config keep their icon names
 * where the config specs can check them.
 *
 * The choice is emitted once the sheet has gone, so a parent can navigate on
 * it or open the next sheet without stranding this one on screen.
 *
 *     <mh-action-sheet [(open)]="open" [title]="name()" [subtitle]="email()"
 *       [actions]="actions()" (chosen)="onAction($event)" />
 */
@Component({
  selector: 'mh-action-sheet',
  imports: [HexAvatar, IonItem, IonLabel, IonList, SheetShell, TranslatePipe],
  templateUrl: './action-sheet.html',
  styleUrl: './action-sheet.scss',
})
export class ActionSheet<T extends string> {
  readonly open = model(false);
  /** Also the dialog's accessible name. */
  readonly title = input.required<string>();
  /** What or who the verbs are about, when the title alone is ambiguous. */
  readonly subtitle = input('');
  /** Translated text above the verbs, for a choice that needs explaining. */
  readonly note = input('');
  readonly actions = input.required<readonly SheetAction<T>[]>();
  /**
   * Off to report the choice straight away and leave the sheet open, for a
   * verb that has to run inside the tap itself — opening the file picker.
   * The parent then closes the sheet when it is done.
   */
  readonly closeOnChoose = input(true);

  readonly chosen = output<T>();

  /** Everything else first, then the verbs that cannot be taken back. */
  readonly groups = computed(() => {
    const actions = this.actions();
    return [actions.filter((action) => !action.destructive), actions.filter((action) => action.destructive)].filter(
      (group) => group.length > 0,
    );
  });

  /** The choice waits here until the sheet has actually gone. */
  private _pending: T | null = null;

  choose(id: T): void {
    if (!this.closeOnChoose()) {
      this.chosen.emit(id);
      return;
    }
    this._pending = id;
    this.open.set(false);
  }

  onDismissed(): void {
    const id = this._pending;
    this._pending = null;
    if (id !== null) this.chosen.emit(id);
  }
}
