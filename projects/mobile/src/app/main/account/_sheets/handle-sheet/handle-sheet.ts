import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { IonInput, IonNote } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import {
  HANDLE_MAX_LENGTH,
  ProfileService,
  WEB_APP_URL,
  handleValidationError,
  normalizeHandle,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/**
 * The vanity slug behind `/@someone`.
 *
 * Shape is checked locally against core's rules; uniqueness is the server's
 * call, so a 409 keeps the sheet open with the message rather than closing.
 */
@Component({
  selector: 'mh-handle-sheet',
  imports: [IonInput, IonNote, SheetShell],
  templateUrl: './handle-sheet.html',
  styleUrl: './handle-sheet.scss',
})
export class HandleSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);

  readonly open = model(false);
  readonly handle = signal('');
  readonly saving = signal(false);
  readonly maxLength = HANDLE_MAX_LENGTH;

  readonly normalized = computed(() => normalizeHandle(this.handle()));
  readonly validationError = computed(() =>
    this.handle() ? handleValidationError(this.handle()) : null,
  );
  readonly canSave = computed(() => !!this.handle() && this.validationError() === null);
  readonly preview = computed(() => `${WEB_APP_URL}/@${this.normalized() || 'your-handle'}`);

  constructor() {
    // Depends on `open()` alone — see the note in `name-sheet`.
    effect(() => {
      if (!this.open()) return;
      this.handle.set(untracked(() => this._accountStore.account()?.handle) ?? '');
    });
  }

  save(): void {
    const handle = this.normalized();
    const previous = this._accountStore.account()?.handle ?? null;

    if (handle === previous) {
      this.open.set(false);
      void this._feedbackService.info('No changes');
      return;
    }

    this.saving.set(true);
    this._profileService
      .updateHandle(handle)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this._accountStore.patchAccount({ handle: result.handle });
          this._accountStore.syncAuthUser();
          this.open.set(false);
          void this._feedbackService.success(`Your handle is now @${result.handle}`);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            'That handle is unavailable. Try a different one.',
          );
        },
      });
  }
}
