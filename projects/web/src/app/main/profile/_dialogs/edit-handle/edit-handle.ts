import {
  ChangeDetectionStrategy,
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
import { ProfileService, apiErrorMessage } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
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

@Component({
  selector: 'mh-edit-handle',
  imports: [FormsModule, Button, Dialog, InputText, Message],
  templateUrl: './edit-handle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditHandle {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

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
  readonly validationError = computed<string | null>(() => {
    const value = this.normalized();
    if (!value) return 'Pick a handle.';
    if (value.length < 3) return 'At least 3 characters.';
    if (value.length > 40) return 'At most 40 characters.';
    if (!HANDLE_REGEX.test(value)) {
      return 'Use lowercase letters, digits, "_" or "-". Must start and end with a letter or digit.';
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
          summary: 'Handle updated',
          detail: `Your profile is now at @${handle}.`,
        });
        this.saved.emit(handle);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Could not update handle',
          detail: apiErrorMessage(
            err,
            'That handle is unavailable. Try a different one.',
          ),
        });
      },
    });
  }
}
