import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonRouterLink,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import {
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  emailSchema,
  isFieldInvalid,
} from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Notice } from '../../../_shared/components/notice/notice';
import { focusFirstInvalidIonic } from '../../../_shared/utils/focus-first-invalid';

/** Asks for a password reset link; the email leads to the new password page. */
@Component({
  selector: 'mh-reset-password',
  imports: [
    FormField,
    FormRoot,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonRouterLink,
    IonSpinner,
    IonToolbar,
    RouterLink,
    TranslatePipe,
    FieldErrorPipe,
    GuestControls,
    Notice,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly _authService = inject(AuthService);
  private readonly _translateService = inject(TranslateService);

  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sent = signal(false);

  protected readonly model = signal({ email: '' });
  protected readonly form = form(this.model, emailSchema, {
    submission: { action: async () => this.send(), onInvalid: focusFirstInvalidIonic },
  });

  constructor() {
    addIcons({ sendOutline });
  }

  private send(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.sent.set(false);
    this._authService
      .forgotPassword(this.model())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.sent.set(true);
          this.form().reset({ email: '' });
        },
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.resetPassword.error')),
          ),
      });
  }
}
