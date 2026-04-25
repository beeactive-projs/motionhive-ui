import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
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
import {
  AuthStore,
  FeedbackCategories,
  FeedbackService,
  InvitationService,
} from 'core';

/**
 * Suggest-an-instructor dialog. Two paths, both useful:
 *
 * 1. **Send the coach an invite** — direct email to the coach
 *    inviting them to join MotionHive as an instructor. Posts to
 *    `POST /invitations/instructor` (endpoint not built yet — falls
 *    back to "tell us about them" toast when it errors).
 *
 * 2. **Tell us about them** — a heads-up to the team. Posts to the
 *    existing `/feedback` endpoint with an `[Instructor suggestion]`
 *    title prefix so it lands in the same inbox we already read.
 */
@Component({
  selector: 'mh-suggest-instructor-dialog',
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
  templateUrl: './suggest-instructor-dialog.html',
  styleUrl: './suggest-instructor-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestInstructorDialog {
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _invitationService = inject(InvitationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model<boolean>(false);

  // ----- Direct-email-to-coach form -----
  protected readonly directForm = new FormGroup({
    coachName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    note: new FormControl(''),
  });

  // ----- Tell-the-team form (free-form contact) -----
  protected readonly tellTeamForm = new FormGroup({
    coachName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    contact: new FormControl('', [Validators.required, Validators.minLength(3)]),
    note: new FormControl(''),
  });

  protected readonly isSending = signal(false);
  protected readonly sent = signal<'direct' | 'team' | null>(null);

  protected isFieldInvalid<F extends FormGroup, K extends keyof F['controls']>(
    form: F,
    field: K,
  ): boolean {
    const c = form.controls[field as string];
    return c.invalid && (c.touched || c.dirty);
  }

  protected onSendDirect(): void {
    if (this.directForm.invalid || this.isSending()) return;
    this.isSending.set(true);

    const { coachName, email, note } = this.directForm.getRawValue();
    this._invitationService
      .suggestInstructorByEmail({
        coachName: coachName!.trim(),
        email: email!.trim(),
        ...(note?.trim() ? { note: note.trim() } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSending.set(false);
          this.sent.set('direct');
        },
        error: () => {
          this.isSending.set(false);
          this._messageService.add({
            severity: 'warn',
            summary: 'Direct invite not ready yet',
            detail: 'Use the other tab — we\'ll reach out for you.',
            life: 5000,
          });
        },
      });
  }

  protected onSendToTeam(): void {
    if (this.tellTeamForm.invalid || this.isSending()) return;
    this.isSending.set(true);

    const { coachName, contact, note } = this.tellTeamForm.getRawValue();
    const user = this._authStore.user();
    const recommender = user ? `${user.firstName} ${user.lastName} (${user.email})` : 'anonymous';
    const message = [
      `Coach: ${coachName}`,
      `Contact: ${contact}`,
      note?.trim() ? `Note: ${note.trim()}` : null,
      `From: ${recommender}`,
    ]
      .filter(Boolean)
      .join('\n');

    this._feedbackService
      .submit({
        type: FeedbackCategories.Suggestion,
        title: `[Instructor suggestion] ${coachName}`,
        message,
        ...(user?.email ? { email: user.email } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSending.set(false);
          this.sent.set('team');
        },
        error: () => {
          this.isSending.set(false);
          this._messageService.add({
            severity: 'error',
            summary: "Couldn't send",
            detail: 'Try again in a moment.',
            life: 4000,
          });
        },
      });
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onDialogHide(): void {
    this.directForm.reset({ coachName: '', email: '', note: '' });
    this.tellTeamForm.reset({ coachName: '', contact: '', note: '' });
    this.sent.set(null);
  }
}
