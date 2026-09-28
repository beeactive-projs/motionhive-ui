import {
  Component,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthStore, InvitationService, environment, validationMessage } from 'core';

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
    ButtonDirective,
    DialogModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    TabsModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './invite-friend-dialog.html',
  styleUrl: './invite-friend-dialog.scss',
})
export class InviteFriendDialog {
  private readonly _authStore = inject(AuthStore);
  private readonly _invitationService = inject(InvitationService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model<boolean>(false);

  protected readonly inviteLink = computed(() => {
    const userId = this._authStore.user()?.id ?? '';
    const ref = userId ? `?ref=${encodeURIComponent(userId)}` : '';
    // Always link to the app's signup route — the marketing site
    // doesn't host a registration form. In dev `environment.appUrl`
    // is localhost; in prod we use the canonical app host.
    const base =
      environment.production && typeof window !== 'undefined'
        ? 'https://app.motionhive.fit'
        : environment.appUrl;
    return `${base}/auth/signup${ref}`;
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
    return validationMessage(this.form.controls.email.errors, {
      required: 'home.inviteFriend.validation.emailRequired',
      email: 'home.inviteFriend.validation.emailInvalid',
    });
  }

  protected onCopy(): void {
    const link = this.inviteLink();
    navigator.clipboard
      .writeText(link)
      .then(() =>
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.detail.linkCopied'),
          detail: this._translateService.instant('home.inviteFriend.toast.copied'),
          life: 3500,
        }),
      )
      .catch(() =>
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('home.inviteFriend.toast.copyFailed.summary'),
          detail: this._translateService.instant('home.inviteFriend.toast.copyFailed.detail'),
          life: 4000,
        }),
      );
  }

  protected onShare(): void {
    navigator
      .share({
        title: this._translateService.instant('home.inviteFriend.share.title'),
        text: this._translateService.instant('home.inviteFriend.share.text'),
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
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.isSending.set(false);
          const detail =
            err.status === 429
              ? this._translateService.instant('home.toast.rateLimited')
              : err.error?.message ||
                this._translateService.instant('home.inviteFriend.toast.sendFailed.detail');
          this._messageService.add({
            severity: 'error',
            summary: this._translateService.instant('home.inviteFriend.toast.sendFailed.summary'),
            detail,
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
