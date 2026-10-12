import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, timer } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  focusFirstInvalid,
  isFieldInvalid,
  newPasswordSchema,
} from 'core';
import { AuthHeader } from '../_components/auth-header/auth-header';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';

/** Where the reset email's link lands (`?token=`): sets the new password. */
@Component({
  selector: 'mh-new-password',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    Message,
    PasswordInput,
    FieldErrorPipe,
    AuthHeader,
  ],
  templateUrl: './new-password.html',
})
export class NewPassword {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _token = this._activatedRoute.snapshot.queryParamMap.get('token') ?? '';
  protected readonly hasToken = !!this._token;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly model = signal({ newPassword: '', confirmPassword: '' });
  protected readonly form = form(this.model, newPasswordSchema, {
    submission: { action: async () => this.save(), onInvalid: focusFirstInvalid },
  });

  private save(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._authService
      .resetPassword({ token: this._token, ...this.model() })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.done.set(true);
          timer(2000)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => void this._router.navigate(['/auth/login']));
        },
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.newPassword.error.resetFailed')),
          ),
      });
  }
}
