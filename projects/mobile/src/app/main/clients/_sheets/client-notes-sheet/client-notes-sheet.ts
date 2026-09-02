import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';

import { InstructorClient, clientDisplayName } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/**
 * The coach's private notes on one client — goals, injuries, what keeps them
 * going. Owner-only on read; the trainee never sees them.
 *
 * The sheet emits the trimmed text and stays open until the page's save
 * lands, so a failed save keeps the draft on screen rather than losing it.
 * An empty string clears the note — the API takes a string, not null.
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

  commit(): void {
    this.save.emit(this.draft().trim());
  }
}
