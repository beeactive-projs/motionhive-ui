import { Component, effect, input, model, output, signal, untracked } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/** The longest personal note the API takes. */
export const EXERCISE_NOTE_MAX_LENGTH = 280;

/**
 * Your own note on a movement, the kind people keep for machine settings
 * ("Seat 4, back pad 2, pin on 3"). Private: only you see it, every time the
 * exercise comes up. Saving it empty removes it.
 */
@Component({
  selector: 'mh-exercise-note-sheet',
  imports: [IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './exercise-note-sheet.html',
})
export class ExerciseNoteSheet {
  readonly open = model(false);
  readonly exerciseName = input('');
  /** The note as it is now. */
  readonly note = input<string | null>(null);
  readonly saving = input(false);

  readonly save = output<string | null>();

  readonly draft = signal('');
  readonly max = EXERCISE_NOTE_MAX_LENGTH;

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => this.draft.set(this.note() ?? ''));
    });
  }

  submit(): void {
    const text = this.draft().trim();
    if (text === (this.note() ?? '').trim()) {
      this.open.set(false);
      return;
    }
    this.save.emit(text || null);
  }
}
