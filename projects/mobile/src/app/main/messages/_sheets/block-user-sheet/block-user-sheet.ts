import { Component, computed, input, model, output } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { BLOCK_REASONS, UserBlockReason } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/**
 * The block confirmation — the reason list from chat details' Privacy row.
 *
 * A component on the sheet shell rather than `ActionSheetController`, same as
 * the client and session action sheets: every sheet shares the shell's chrome.
 * Choosing a reason is the confirmation, one step like the controller version;
 * the page owns the actual block.
 */
@Component({
  selector: 'mh-block-user-sheet',
  imports: [IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './block-user-sheet.html',
  styleUrl: './block-user-sheet.scss',
})
export class BlockUserSheet {
  readonly open = model(false);
  readonly name = input.required<string>();

  readonly confirm = output<UserBlockReason>();

  readonly reasons = BLOCK_REASONS;

  readonly title = computed(() => `Block ${this.name()}?`);

  choose(reason: UserBlockReason): void {
    this.open.set(false);
    this.confirm.emit(reason);
  }
}
