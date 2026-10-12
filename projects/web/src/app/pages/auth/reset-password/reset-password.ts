import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import {
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  emailSchema,
  focusFirstInvalid,
  isFieldInvalid,
} from 'core';
import { AuthHeader } from '../_components/auth-header/auth-header';

/** Asks for a password reset link; the email leads to the new password page. */
@Component({
  selector: 'mh-reset-password',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    InputText,
    Message,
    FieldErrorPipe,
    AuthHeader,
  ],
  templateUrl: './reset-password.html',
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
    submission: { action: async () => this.send(), onInvalid: focusFirstInvalid },
  });

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
            apiErrorMessage(err, this._translateService.instant('auth.resetPassword.error.sendFailed')),
          ),
      });
  }
}
