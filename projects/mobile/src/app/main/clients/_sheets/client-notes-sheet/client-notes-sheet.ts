import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';

import { InstructorClient, clientDisplayName } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { NOTES_MAX_LENGTH } from '../../clients.config';

/**
 * The coach's private notes on one client — goals, injuries, what keeps them
 * going. Owner-only on read; the trainee never sees them.
 *
 * The sheet emits the trimmed text and stays open until the page's save
 * lands, so a failed save keeps the draft on screen rather than losing it.
 * An empty string clears the note — the API takes a string, not null.
 *
 * Save is gated on the draft having actually changed and still fitting. It
 * used to be unconditional, which meant a stray tap on a sheet opened and
 * left alone re-saved the same text, and a sheet whose field had been cleared
 * blanked an existing note with no confirmation and no way back.
 */
@Component({
  selector: 'mh-client-notes-sheet',
  imports: [IonTextarea, SheetShell],
  templateUrl: './client-notes-sheet.html',
  styleUrl: './client-notes-sheet.scss',
})
export class ClientNotesSheet {
  readonly open = model(false);
  readonly client = input<InstructorClient | null>(null);
  readonly saving = input(false);

  readonly save = output<string>();

  readonly draft = signal('');

  readonly maxLength = NOTES_MAX_LENGTH;

  constructor() {
    // Seeded on open so a dismissed edit is discarded rather than carried over.
    effect(() => {
      if (!this.open()) return;
      this.draft.set(this.client()?.notes ?? '');
    });
  }

  readonly title = computed(() => {
    const client = this.client();
    return client ? `Notes · ${clientDisplayName(client)}` : 'Notes';
  });

  /** What would actually be sent — compared against what is already stored. */
  private readonly _trimmed = computed(() => this.draft().trim());

  readonly tooLong = computed(() => this._trimmed().length > NOTES_MAX_LENGTH);

  readonly overBy = computed(() =>
    Math.max(0, this._trimmed().length - NOTES_MAX_LENGTH),
  );

  /** Clearing a note is a real edit; re-saving the same text is not. */
  readonly dirty = computed(() => this._trimmed() !== (this.client()?.notes ?? '').trim());

  readonly canSave = computed(() => this.dirty() && !this.tooLong());

  commit(): void {
    if (!this.canSave()) return;
    this.save.emit(this._trimmed());
  }
}
