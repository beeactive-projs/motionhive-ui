import { Component, input, model, output, viewChild } from '@angular/core';
import { IonIcon, IonNote } from '@ionic/angular/standalone';

import { SheetShell } from '../sheet-shell/sheet-shell';

/** One line of "here is what you are actually agreeing to". */
export interface ConfirmFact {
  label: string;
  value: string;
}

/**
 * The confirmation every money action in this feature shares.
 *
 * Sending, voiding, marking paid, refunding and cancelling a membership are
 * five different verbs with one shape: say plainly what will happen, list the
 * facts that decide it, and give one way forward and one way out. Five
 * bespoke sheets would drift apart in tone, which is how a refund ends up
 * sounding gentler than marking something paid.
 *
 * `blockedReason` is shown rather than hiding the action. A refund past its
 * window is a question the coach will ask again tomorrow; an absent button
 * answers nothing.
 */
@Component({
  selector: 'mh-confirm-sheet',
  imports: [IonIcon, IonNote, SheetShell],
  templateUrl: './confirm-sheet.html',
  styleUrl: './confirm-sheet.scss',
})
export class ConfirmSheet {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly facts = input<readonly ConfirmFact[]>([]);
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  /** `danger` for anything that destroys or moves money back. */
  readonly tone = input<'primary' | 'danger'>('primary');
  /** Named consequence that cannot be undone — stated, never buried. */
  readonly irreversible = input<string | null>(null);
  /** Why the action cannot be taken. Present means the button is disabled. */
  readonly blockedReason = input<string | null>(null);
  readonly saving = input(false);

  readonly confirm = output<void>();

  private readonly _shell = viewChild(SheetShell);

  /**
   * Close and await the dismissal, for callers that navigate once the action
   * lands. Flipping `open` is enough on a page that stays put, but routing
   * away detaches the view from change detection before `[isOpen]` is
   * applied — and the sheet is then stranded on top of the new page. Same
   * contract as `SheetShell.close()`, which this delegates to.
   */
  async close(): Promise<void> {
    this.open.set(false);
    await this._shell()?.close();
  }
}
