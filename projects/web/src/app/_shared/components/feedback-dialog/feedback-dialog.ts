import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import type { ButtonSeverity } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FeedbackService, FeedbackCategory, AuthStore } from 'core';
import { AutoFocusModule } from 'primeng/autofocus';

@Component({
  selector: 'bee-feedback-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    ToastModule,
    AutoFocusModule,
  ],
  providers: [MessageService],
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackDialog {
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);

  protected readonly visible = this._feedbackService.isOpen;
  protected readonly isGuest = computed(() => !this._authStore.isAuthenticated());

  protected readonly types: {
    key: FeedbackCategory;
    label: string;
    icon: string;
    severity: ButtonSeverity;
  }[] = [
    { key: 'bug', label: 'Bug Report', icon: 'bug_report', severity: 'danger' },
    { key: 'suggestion', label: 'Suggestion', icon: 'lightbulb', severity: 'warn' },
    { key: 'other', label: 'Other', icon: 'chat', severity: 'info' },
  ];

  protected readonly form = new FormGroup({
    type: new FormControl<FeedbackCategory | null>(this.types[0].key, Validators.required),
    title: new FormControl('', [Validators.required, Validators.minLength(3)]),
    message: new FormControl('', [Validators.required, Validators.minLength(10)]),
    email: new FormControl('', [Validators.email]),
  });

  private readonly _selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.types[0].key,
  });

  protected readonly placeholders = computed(() => {
    const type = this._selectedType();
    switch (type) {
      case 'bug':
        return {
          title: 'e.g. Session attendance not saving correctly',
          message:
            'What were you doing when it happened? What did you expect vs. what actually occurred?',
        };
      case 'suggestion':
        return {
          title: 'e.g. Show progress charts per client',
          message:
            'Describe the feature and how it would improve your workflow as a trainer or organizer...',
        };
      default:
        return {
          title: 'e.g. Question about managing group sessions',
          message: "What's on your mind? We're happy to help.",
        };
    }
  });

  protected readonly isLoading = signal(false);
  protected readonly submitted = signal(false);

  protected onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;
    this.isLoading.set(true);
    const { type, title, message, email } = this.form.getRawValue();
    const user = this._authStore.user();
    const payload = {
      type: type!,
      title: title!,
      message: message!,
      ...(user ? { userId: user.id } : email ? { email } : {}),
    };
    this._feedbackService
      .submit(payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.submitted.set(true);
          // this._messageService.add({
          //   severity: 'success',
          //   summary: 'Feedback sent',
          //   detail: 'Thank you for your feedback!',
          //   life: 4000,
          // });
          // this.onClose();
        },
        error: () => {
          this.isLoading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Something went wrong',
            detail: 'Could not send feedback. Please try again.',
            life: 5000,
          });
        },
      });
  }

  protected onClose(): void {
    this._feedbackService.close();
  }

  protected onDialogHide(): void {
    this.form.reset({ type: this.types[0].key, title: '', message: '', email: '' });
    this.submitted.set(false);
  }
}
