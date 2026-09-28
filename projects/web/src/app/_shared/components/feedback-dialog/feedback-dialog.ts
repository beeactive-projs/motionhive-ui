import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import type { ButtonSeverity } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AutoFocusModule } from 'primeng/autofocus';
import { FeedbackService, AuthStore, FeedbackCategory, FeedbackCategories } from 'core';

@Component({
  selector: 'mh-feedback-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DialogModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    ToastModule,
    AutoFocusModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.scss',
})
export class FeedbackDialog {
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);

  protected readonly visible = this._feedbackService.isOpen;

  /** `label` is a translation key; the template translates it. */
  protected readonly types: {
    key: FeedbackCategory;
    label: string;
    icon: string;
    severity: ButtonSeverity;
  }[] = [
    {
      key: FeedbackCategories.Suggestion,
      label: 'components.feedbackDialog.type.SUGGESTION',
      icon: 'lightbulb',
      severity: 'warn',
    },
    {
      key: FeedbackCategories.Bug,
      label: 'components.feedbackDialog.type.BUG',
      icon: 'bug_report',
      severity: 'danger',
    },

    {
      key: FeedbackCategories.Other,
      label: 'components.feedbackDialog.type.OTHER',
      icon: 'chat',
      severity: 'info',
    },
  ];

  protected readonly form = new FormGroup({
    type: new FormControl<FeedbackCategory | null>(this.types[0].key, Validators.required),
    title: new FormControl('', [Validators.required, Validators.minLength(3)]),
    message: new FormControl('', [Validators.required, Validators.minLength(10)]),
  });

  private readonly _selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: FeedbackCategories.Suggestion,
  });

  /** Translation keys for the title / message placeholders of the selected type. */
  protected readonly placeholders = computed(() => {
    const type = this._selectedType();
    switch (type) {
      case FeedbackCategories.Bug:
        return {
          title: 'components.feedbackDialog.placeholder.BUG.title',
          message: 'components.feedbackDialog.placeholder.BUG.message',
        };
      case FeedbackCategories.Suggestion:
        return {
          title: 'components.feedbackDialog.placeholder.SUGGESTION.title',
          message: 'components.feedbackDialog.placeholder.SUGGESTION.message',
        };
      default:
        return {
          title: 'components.feedbackDialog.placeholder.OTHER.title',
          message: 'components.feedbackDialog.placeholder.OTHER.message',
        };
    }
  });

  protected readonly isLoading = signal(false);
  protected readonly submitted = signal(false);

  protected onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;
    this.isLoading.set(true);
    const { type, title, message } = this.form.getRawValue();
    // Authenticated users default their contact email from the JWT
    // profile so the confirmation mail (if any) lands where they'd
    // expect. Anonymous visitors can omit it entirely — the BE never
    // sends mail to a random user id.
    const user = this._authStore.user();
    const payload = {
      type: type!,
      title: title!,
      message: message!,
      ...(user?.email ? { email: user.email } : {}),
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
            summary: this._translateService.instant('toast.detail.somethingWentWrong'),
            detail: this._translateService.instant('components.feedbackDialog.toast.sendFailed'),
            life: 5000,
          });
        },
      });
  }

  protected onClose(): void {
    this._feedbackService.close();
  }

  protected onDialogHide(): void {
    this.form.reset({ type: FeedbackCategories.Suggestion, title: '', message: '' });
    this.submitted.set(false);
  }
}
