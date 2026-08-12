import { Component, effect, inject, model, signal, untracked } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import { ProfileService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

const BIO_MAX_LENGTH = 4000;

/** The instructor profile's `bio` — coach accounts only. */
@Component({
  selector: 'mh-about-sheet',
  imports: [IonTextarea, SheetShell],
  templateUrl: './about-sheet.html',
  styleUrl: './about-sheet.scss',
})
export class AboutSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);

  readonly open = model(false);
  readonly bio = signal('');
  readonly saving = signal(false);
  readonly maxLength = BIO_MAX_LENGTH;

  constructor() {
    // Depends on `open()` alone — see the note in `name-sheet`.
    effect(() => {
      if (!this.open()) return;
      this.bio.set(untracked(() => this._accountStore.instructorProfile()?.bio) ?? '');
    });
  }

  save(): void {
    const bio = this.bio().trim();
    const previous = this._accountStore.instructorProfile()?.bio ?? '';

    if (bio === previous) {
      this.open.set(false);
      void this._feedbackService.info('No changes');
      return;
    }

    this.saving.set(true);
    this._accountStore.patchInstructor({ bio });

    this._profileService
      .updateInstructorProfile({ bio })
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this.saving.set(false);
          this._accountStore.patchInstructor(profile);
          this.open.set(false);
          void this._feedbackService.success('About updated');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchInstructor({ bio: previous });
          void this._feedbackService.error(error, 'Could not update your bio.');
        },
      });
  }
}
