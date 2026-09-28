import { Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

// Core imports
import { AuthService, Logo, validationMessage } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    InputTextModule,
    MessageModule,
    ThemeToggleComponent,
    Logo,
    TranslatePipe,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _translateService = inject(TranslateService);

  // Signals for component state
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Reactive form
  forgotPasswordForm: FormGroup = this._formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const email = this.forgotPasswordForm.value.email;

    this._authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set(this._translateService.instant('auth.resetPassword.sent'));
        this.forgotPasswordForm.reset();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message ||
            this._translateService.instant('auth.resetPassword.error.sendFailed'),
        );
      },
    });
  }

  // Helper methods for validation
  isFieldInvalid(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    return validationMessage(this.forgotPasswordForm.get(fieldName)?.errors);
  }
}
