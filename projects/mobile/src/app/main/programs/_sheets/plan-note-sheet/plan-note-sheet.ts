import { Component, effect, input, model, output, signal, untracked } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/** The longest note a plan's exercise takes (the API's limit). */
export const PLAN_NOTE_MAX_LENGTH = 2000;

/**
 * The coach's note on one exercise of a program day ("Pause one second at
 * the bottom"): the client reads it on the exercise's card. Unlike a
 * person's own note on a movement (`exercise-note-sheet`), it is not
 * private, so the sheet says who sees it. Saving it empty removes it.
 */
@Component({
  selector: 'mh-plan-note-sheet',
  imports: [IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './plan-note-sheet.html',
})
export class PlanNoteSheet {
  readonly open = model(false);
  readonly exerciseName = input('');
  /** The note as it is now. */
  readonly note = input<string | null>(null);
  readonly saving = input(false);

  /** The new note, or null to remove it. Not sent when nothing changed. */
  readonly save = output<string | null>();

  readonly draft = signal('');
  readonly max = PLAN_NOTE_MAX_LENGTH;

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => {
        let note = this.note();
        if (note === null) {
          note = '';
        }
        this.draft.set(note);
      });
    });
  }

  submit(): void {
    const text = this.draft().trim();
    let current = this.note();
    if (current === null) {
      current = '';
    }
    if (text === current.trim()) {
      this.open.set(false);
      return;
    }
    if (!text) {
      this.save.emit(null);
      return;
    }
    this.save.emit(text);
  }
}
