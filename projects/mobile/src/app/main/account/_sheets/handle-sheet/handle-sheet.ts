import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { IonInput, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import {
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  ProfileService,
  ValidationKeyOverrides,
  WEB_APP_URL,
  handleValidationError,
  normalizeHandle,
  validationMessage,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/** Handle-specific wording for the generic validator errors. */
const HANDLE_ERROR_KEYS: ValidationKeyOverrides = {
  required: 'accountSheets.handle.validation.required',
  minlength: 'accountSheets.handle.validation.minLength',
  maxlength: 'accountSheets.handle.validation.maxLength',
  pattern: 'accountSheets.handle.validation.pattern',
};

/**
 * Core's `handleValidationError` decides *whether* a handle is usable, but its
 * reason is English text. This restates the same rules as validator errors so
 * the message goes through `validationMessage` and gets translated.
 */
function handleErrors(raw: string): ValidationErrors | null {
  if (handleValidationError(raw) === null) return null;
  const handle = normalizeHandle(raw);
  if (!handle) return { required: true };
  if (handle.length < HANDLE_MIN_LENGTH) {
    return { minlength: { requiredLength: HANDLE_MIN_LENGTH, actualLength: handle.length } };
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return { maxlength: { requiredLength: HANDLE_MAX_LENGTH, actualLength: handle.length } };
  }
  return { pattern: { requiredPattern: String(HANDLE_PATTERN), actualValue: handle } };
}

/**
 * The vanity slug behind `/@someone`.
 *
 * Shape is checked locally against core's rules; uniqueness is the server's
 * call, so a 409 keeps the sheet open with the message rather than closing.
 */
@Component({
  selector: 'mh-handle-sheet',
  imports: [IonInput, IonNote, SheetShell, TranslatePipe],
  templateUrl: './handle-sheet.html',
  styleUrl: './handle-sheet.scss',
})
export class HandleSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly handle = signal('');
  readonly saving = signal(false);
  readonly maxLength = HANDLE_MAX_LENGTH;

  readonly normalized = computed(() => normalizeHandle(this.handle()));
  readonly validationError = computed(() => {
    const errors = this.handle() ? handleErrors(this.handle()) : null;
    return errors ? validationMessage(errors, HANDLE_ERROR_KEYS) : null;
  });
  readonly canSave = computed(() => !!this.handle() && this.validationError() === null);
  readonly preview = computed(() => {
    const slug =
      this.normalized() || this._translateService.instant('accountSheets.handle.previewPlaceholder');
    return `${WEB_APP_URL}/@${slug}`;
  });

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
      void this._feedbackService.info(this._translateService.instant('toast.detail.noChanges'));
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
          void this._feedbackService.success(
            this._translateService.instant('accountSheets.handle.toast.updated', {
              handle: result.handle,
            }),
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.handle.toast.failed'),
          );
        },
      });
  }
}
