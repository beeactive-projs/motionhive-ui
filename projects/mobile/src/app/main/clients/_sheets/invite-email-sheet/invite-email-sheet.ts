import { Component, computed, effect, input, model, output, signal, viewChild } from '@angular/core';
import { IonButton, IonIcon, IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { INVITE_EXPIRY_DAYS, INVITE_MESSAGE_MAX_LENGTH } from '../../invite.utils';

/**
 * Confirming an invitation to an address, and what to do once it has gone.
 *
 * The address is already typed by the time this opens — it is the search
 * field's own text — so the sheet only has to say what will happen, offer the
 * note, and send. The note is folded away: it is worth having for a cold
 * email from a product the person has never heard of, and worth nothing on
 * the main path, where every extra field is a reason to stop.
 *
 * Purely presentational. The page owns the request, the toast and the
 * navigation, as `client-notes-sheet` does — which is also why `done` is an
 * output rather than a `close()` here: the page has to await the dismissal
 * before it routes.
 */
@Component({
  selector: 'mh-invite-email-sheet',
  imports: [HexAvatar, IonButton, IonIcon, IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './invite-email-sheet.html',
  styleUrl: './invite-email-sheet.scss',
})
export class InviteEmailSheet {
  readonly open = model(false);

  /**
   * Snapshotted by the page when the sheet opens, never read live from the
   * search field: that field keeps its value behind the modal, and a stray
   * keystroke would send somewhere other than the subtitle says.
   */
  readonly address = input.required<string>();
  readonly saving = input(false);
  /** Set once the invitation lands — the token its signup link carries. */
  readonly sentToken = input<string | null>(null);

  readonly send = output<string>();
  readonly share = output<void>();
  readonly done = output<void>();

  readonly expiryDays = INVITE_EXPIRY_DAYS;
  readonly messageMaxLength = INVITE_MESSAGE_MAX_LENGTH;

  readonly note = signal('');
  readonly noteOpen = signal(false);

  readonly noteToggleLabel = computed(() =>
    this.noteOpen() ? 'clients.invite.emailSheet.hideNote' : 'clients.invite.emailSheet.addNote',
  );

  private readonly _shell = viewChild(SheetShell);

  constructor() {
    // Seeded on open, so a note typed and dismissed is discarded rather than
    // carried into the next address.
    effect(() => {
      if (!this.open()) return;
      this.note.set('');
      this.noteOpen.set(false);
    });
  }

  toggleNote(): void {
    this.noteOpen.update((open) => !open);
  }

  onSend(): void {
    this.send.emit(this.note().trim());
  }

  /** Close and await the dismissal, for the page that routes straight after. */
  async close(): Promise<void> {
    await this._shell()?.close();
  }
}
