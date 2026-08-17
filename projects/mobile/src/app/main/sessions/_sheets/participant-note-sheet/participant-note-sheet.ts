import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';

import { SessionParticipant, displayName } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/**
 * The coach's private note about one attendee.
 *
 * The design puts a free-text note on the session itself, but there is no
 * session-level note field — `descriptionOverride` is the only free text on an
 * instance and it is public-facing, so writing "kept favouring the left knee"
 * there would publish it. `privateNote` on a participant is owner-only on read
 * and already has a store method with no callers, so the note lands where it is
 * actually safe and becomes per-person, which is more useful anyway.
 */
@Component({
  selector: 'mh-participant-note-sheet',
  imports: [IonTextarea, SheetShell],
  templateUrl: './participant-note-sheet.html',
  styleUrl: './participant-note-sheet.scss',
})
export class ParticipantNoteSheet {
  readonly open = model(false);
  readonly participant = input<SessionParticipant | null>(null);
  readonly saving = input(false);

  /** Null clears the note rather than storing an empty string. */
  readonly save = output<string | null>();

  readonly draft = signal('');

  constructor() {
    // Seeded on open so a dismissed edit is discarded rather than carried over.
    effect(() => {
      if (!this.open()) return;
      this.draft.set(this.participant()?.privateNote ?? '');
    });
  }

  readonly title = computed(() => {
    const participant = this.participant();
    return participant ? `Note · ${displayName(participant.user, 'Someone')}` : 'Note';
  });

  commit(): void {
    const text = this.draft().trim();
    this.save.emit(text.length > 0 ? text : null);
    this.open.set(false);
  }
}
