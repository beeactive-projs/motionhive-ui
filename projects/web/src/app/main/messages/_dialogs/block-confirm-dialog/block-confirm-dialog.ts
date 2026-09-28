import {
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BLOCK_REASONS, EnumLabelPipe, MessagingStore, translate, UserBlockReason } from 'core';

/**
 * Confirm-and-block dialog. Two slots:
 *   - Display name of the user being blocked (informational).
 *   - Optional reason chip — surfaced to the BE so we can later
 *     aggregate ("how many blocks cite SCAM"). v1 doesn't require it.
 *
 * On success: the store removes the conversation from the inbox and
 * navigates back to /messages. Local mute/threat state for that
 * conversation is also dropped.
 */
@Component({
  selector: 'mh-block-confirm-dialog',
  imports: [ButtonDirective, Dialog, EnumLabelPipe, TranslatePipe],
  templateUrl: './block-confirm-dialog.html',
  styleUrl: './block-confirm-dialog.scss',
})
export class BlockConfirmDialog {
  private readonly _store = inject(MessagingStore);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly blockedId = input<string | null>(null);
  readonly conversationId = input<string | null>(null);
  readonly displayName = input<string>(translate('messages.thisUser'));
  readonly blocked = output<void>();

  protected readonly submitting = signal(false);
  protected readonly reason = signal<UserBlockReason | null>(null);

  /** Reason chips in display order; labels come from `enum.userBlockReason.<value>`. */
  protected readonly reasons: readonly UserBlockReason[] = BLOCK_REASONS.map((r) => r.value);

  protected selectReason(r: UserBlockReason): void {
    // Toggle off when the same chip is tapped again.
    this.reason.update((cur) => (cur === r ? null : r));
  }

  protected async submit(): Promise<void> {
    const id = this.blockedId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);

    const ok = await this._store.blockUser({
      blockedId: id,
      reason: this.reason(),
      conversationId: this.conversationId(),
    });

    this.submitting.set(false);

    if (ok) {
      this._messageService.add({
        severity: 'success',
        summary: this._translateService.instant('messages.toast.blocked'),
        detail: this._translateService.instant('messages.toast.blockedDetail', {
          name: this.displayName(),
        }),
      });
      this.visible.set(false);
      this.blocked.emit();
    } else {
      this._messageService.add({
        severity: 'error',
        summary: this._translateService.instant('messages.toast.blockFailed'),
        detail: this._translateService.instant('common.pleaseTryAgain'),
      });
    }
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  protected onHide(): void {
    // Reset state when the dialog closes (any path).
    this.reason.set(null);
  }
}
