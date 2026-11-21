import { Component, computed, inject, model } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import type { Gender } from 'core';

import { ChoiceOption, ChoiceSheet } from '../../../../_shared/components/choice-sheet/choice-sheet';
import { GENDER_CHOICES, toGender } from '../../../../_shared/config/about-you.config';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/**
 * The gender: the owner's three choices, saved on the tap like any choice
 * sheet, and "Remove gender" while one is saved. Optional.
 */
@Component({
  selector: 'mh-gender-sheet',
  imports: [ChoiceSheet, TranslatePipe],
  templateUrl: './gender-sheet.html',
})
export class GenderSheet {
  private readonly _accountStore = inject(AccountStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);

  readonly selected = this._accountStore.gender;

  readonly options = computed<ChoiceOption[]>(() =>
    GENDER_CHOICES.map((choice) => ({
      value: choice.gender,
      label: this._translateService.instant(choice.label),
    })),
  );

  onPicked(value: string): void {
    const gender = toGender(value);
    if (!gender) {
      return;
    }
    this._save(gender, 'accountSheets.gender.toast.updated');
  }

  onCleared(): void {
    this._save(null, 'accountSheets.gender.toast.removed');
  }

  /** The sheet is already closed: the row shows the choice at once, and goes back if it fails. */
  private _save(gender: Gender | null, doneKey: string): void {
    this._accountStore
      .updateAboutYou({ gender })
      .pipe(take(1))
      .subscribe({
        next: () => {
          void this._feedbackService.success(this._translateService.instant(doneKey));
        },
        error: (error: unknown) => {
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.gender.toast.failed'),
          );
        },
      });
  }
}
