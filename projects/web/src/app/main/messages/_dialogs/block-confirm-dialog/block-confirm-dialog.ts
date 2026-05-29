import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { MessagingStore, UserBlockReason } from 'core';

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
  standalone: true,
  imports: [Button, Dialog],
  templateUrl: './block-confirm-dialog.html',
  styleUrl: './block-confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockConfirmDialog {
  private readonly _store = inject(MessagingStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly blockedId = input<string | null>(null);
  readonly conversationId = input<string | null>(null);
  readonly displayName = input<string>('this user');
  readonly blocked = output<void>();

  protected readonly submitting = signal(false);
  protected readonly reason = signal<UserBlockReason | null>(null);

  protected readonly reasons: { key: UserBlockReason; label: string }[] = [
    { key: 'SPAM', label: 'Spam' },
    { key: 'HARASSMENT', label: 'Harassment' },
    { key: 'SCAM', label: 'Scam' },
    { key: 'IMPERSONATION', label: 'Impersonation' },
    { key: 'OTHER', label: 'Other' },
  ];

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
        summary: 'User blocked',
        detail: `${this.displayName()} can no longer message you.`,
      });
      this.visible.set(false);
      this.blocked.emit();
    } else {
      this._messageService.add({
        severity: 'error',
        summary: 'Could not block',
        detail: 'Please try again.',
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
