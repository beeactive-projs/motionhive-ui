import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProfileService, TranslateParams, apiErrorMessage } from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';

/**
 * Small dialog for claiming or renaming the profile handle (the slug
 * used by `/@<handle>`). Validates client-side against the same regex
 * the server enforces so the user sees feedback before submit; the
 * uniqueness check itself is server-authoritative (409 surfaces as a
 * friendly toast).
 */
const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 40;

/** A validation message as a translation key plus its params. */
interface HandleError {
  key: string;
  params?: TranslateParams;
}

@Component({
  selector: 'mh-edit-handle',
  imports: [FormsModule, ButtonDirective, Dialog, InputText, Message, TranslatePipe],
  templateUrl: './edit-handle.html',
})
export class EditHandle {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly maxLength = HANDLE_MAX_LENGTH;

  readonly visible = model(false);
  readonly currentHandle = input<string | null>(null);
  readonly saved = output<string>();

  readonly handle = signal('');
  readonly saving = signal(false);

  readonly normalized = computed(() => this.handle().trim().toLowerCase());

  /**
   * Inline validation message — `null` means valid, anything else
   * blocks submit and renders under the input.
   */
  readonly validationError = computed<HandleError | null>(() => {
    const value = this.normalized();
    if (!value) return { key: 'profile.editHandle.validation.required' };
    if (value.length < HANDLE_MIN_LENGTH) {
      return { key: 'profile.editHandle.validation.minLength', params: { min: HANDLE_MIN_LENGTH } };
    }
    if (value.length > HANDLE_MAX_LENGTH) {
      return { key: 'profile.editHandle.validation.maxLength', params: { max: HANDLE_MAX_LENGTH } };
    }
    if (!HANDLE_REGEX.test(value)) {
      return { key: 'profile.editHandle.validation.pattern' };
    }
    return null;
  });

  readonly unchanged = computed(
    () => this.normalized() === (this.currentHandle() ?? '').toLowerCase(),
  );

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      this.handle.set(this.currentHandle() ?? '');
    }
  });

  save(): void {
    if (this.validationError() || this.unchanged()) return;
    const next = this.normalized();
    this.saving.set(true);
    this._profileService.updateHandle(next).subscribe({
      next: ({ handle }) => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('profile.editHandle.toast.updated.summary'),
          detail: this._translateService.instant('profile.editHandle.toast.updated.detail', { handle }),
        });
        this.saved.emit(handle);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('profile.editHandle.toast.failed.summary'),
          detail: apiErrorMessage(
            err,
            this._translateService.instant('profile.editHandle.toast.failed.detail'),
          ),
        });
      },
    });
  }
}
