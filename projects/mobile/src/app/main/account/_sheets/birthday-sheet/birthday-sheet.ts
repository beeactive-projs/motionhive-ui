import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { BirthdayField } from '../../../../_shared/components/birthday-field/birthday-field';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/**
 * The birthday: its row opens the date picker, Save keeps the day picked,
 * and "Remove birthday" (a red card of its own, while there is one) takes
 * it off the account. Optional, and nothing gates an age.
 */
@Component({
  selector: 'mh-birthday-sheet',
  imports: [BirthdayField, HexAvatar, IonItem, IonLabel, IonList, SheetShell, TranslatePipe],
  templateUrl: './birthday-sheet.html',
})
export class BirthdaySheet {
  private readonly _accountStore = inject(AccountStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);

  /** The day picked here; the saved one until another is picked. */
  readonly draft = signal<string | null>(null);
  readonly saving = signal(false);

  readonly hasSaved = computed(() => this._accountStore.birthDate() !== null);
  readonly canSave = computed(() => {
    const draft = this.draft();
    return draft !== null && draft !== this._accountStore.birthDate();
  });

  constructor() {
    // Seeded on every opening, from `open()` alone (see `name-sheet`): a
    // picked and cancelled day never shows up the next time.
    effect(() => {
      if (!this.open()) {
        return;
      }
      this.draft.set(untracked(() => this._accountStore.birthDate()));
    });
  }

  save(): void {
    const birthDate = this.draft();
    if (!this.canSave() || birthDate === null) {
      return;
    }
    this._save(birthDate, 'accountSheets.birthday.toast.updated');
  }

  remove(): void {
    if (this.saving() || !this.hasSaved()) {
      return;
    }
    this._save(null, 'accountSheets.birthday.toast.removed');
  }

  private _save(birthDate: string | null, doneKey: string): void {
    this.saving.set(true);
    this._accountStore
      .updateAboutYou({ birthDate })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success(this._translateService.instant(doneKey));
        },
        // The day picked stays, to try again.
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.birthday.toast.failed'),
          );
        },
      });
  }
}
