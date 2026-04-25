import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthStore, InvitationService, environment } from 'core';

/**
 * Invite-a-friend dialog. Two paths:
 *
 * 1. **Get a link** — generates a personal invite link (`?ref={userId}`)
 *    for the user to copy or share via the system share sheet. Always
 *    works, no backend call.
 *
 * 2. **Send an email** — posts to `POST /invitations/friend` with the
 *    friend's email + an optional personal message. The endpoint
 *    doesn't exist yet (lives with the upcoming jobs/notifications
 *    module). When it 404s/errors, we fall back to a toast that
 *    nudges the user back to the link tab.
 */
@Component({
  selector: 'mh-invite-friend-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    TabsModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './invite-friend-dialog.html',
  styleUrl: './invite-friend-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteFriendDialog {
  private readonly _authStore = inject(AuthStore);
  private readonly _invitationService = inject(InvitationService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model<boolean>(false);

  protected readonly inviteLink = computed(() => {
    const userId = this._authStore.user()?.id ?? '';
    const ref = userId ? `?ref=${encodeURIComponent(userId)}` : '';
    const base =
      environment.production && typeof window !== 'undefined'
        ? 'https://motionhive.fit'
        : environment.appUrl;
    return `${base}/signup${ref}`;
  });

  protected readonly canShare = signal(
    typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  );

  protected readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    personalMessage: new FormControl(''),
  });

  protected readonly isSending = signal(false);
  protected readonly emailSent = signal(false);

  protected isEmailInvalid(): boolean {
    const c = this.form.controls.email;
    return c.invalid && (c.touched || c.dirty);
  }

  protected emailError(): string {
    const c = this.form.controls.email;
    if (c.hasError('required')) return "What's your friend's email?";
    if (c.hasError('email')) return "Hmm, that doesn't look like an email.";
    return '';
  }

  protected onCopy(): void {
    const link = this.inviteLink();
    navigator.clipboard
      .writeText(link)
      .then(() =>
        this._messageService.add({
          severity: 'success',
          summary: 'Link copied',
          detail: 'Send it to your friend — first session is on us.',
          life: 3500,
        }),
      )
      .catch(() =>
        this._messageService.add({
          severity: 'error',
          summary: "Couldn't copy",
          detail: 'Select the link and copy it manually.',
          life: 4000,
        }),
      );
  }

  protected onShare(): void {
    navigator
      .share({
        title: 'Train with me on MotionHive',
        text: "Come train with me on MotionHive — your first session's on us.",
        url: this.inviteLink(),
      })
      .catch(() => {});
  }

  protected onSendEmail(): void {
    if (this.form.invalid || this.isSending()) return;
    this.isSending.set(true);

    const { email, personalMessage } = this.form.getRawValue();
    this._invitationService
      .sendFriendInvite({
        email: email!.trim(),
        ...(personalMessage?.trim() ? { personalMessage: personalMessage.trim() } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSending.set(false);
          this.emailSent.set(true);
        },
        error: () => {
          this.isSending.set(false);
          this._messageService.add({
            severity: 'warn',
            summary: 'Email send not ready yet',
            detail: 'Copy the link instead — we\'ll have email invites soon.',
            life: 5000,
          });
        },
      });
  }

  protected onLinkFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement | null)?.select();
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onDialogHide(): void {
    this.form.reset({ email: '', personalMessage: '' });
    this.emailSent.set(false);
  }
}
