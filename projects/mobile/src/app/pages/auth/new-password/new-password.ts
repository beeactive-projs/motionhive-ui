import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonRouterLink,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';

import { AuthService } from 'core';

/**
 * Sets a new password from the emailed reset link. Reachable only with a
 * `?token=` query param — until deep links land, that means opening the
 * link in the app manually; the page is part of v1 auth so the flow is
 * complete when deep linking arrives.
 */
@Component({
  selector: 'mh-new-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonInputPasswordToggle,
    IonRouterLink,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './new-password.html',
  styleUrl: './new-password.scss',
})
export class NewPassword {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);

  private readonly _token = this._route.snapshot.queryParamMap.get('token') ?? '';

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly hasToken = signal(!!this._token);

  newPasswordForm: FormGroup = this._formBuilder.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  onSubmit(): void {
    if (this.newPasswordForm.invalid) {
      this.newPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._authService
      .resetPassword({
        token: this._token,
        newPassword: this.newPasswordForm.value.newPassword,
        confirmPassword: this.newPasswordForm.value.confirmPassword,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.successMessage.set(
            'Your password has been reset successfully. Redirecting to sign in…',
          );
          setTimeout(() => {
            this._navController.navigateRoot('/auth/login');
          }, 2000);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error.error?.message || 'Failed to reset password. The link may have expired.',
          );
        },
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.newPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  isConfirmPasswordInvalid(): boolean {
    const field = this.newPasswordForm.get('confirmPassword');
    if (!field || !(field.dirty || field.touched)) return false;
    return field.hasError('required') || this.newPasswordForm.hasError('passwordMismatch');
  }

  getConfirmPasswordError(): string {
    const field = this.newPasswordForm.get('confirmPassword');
    if (!field) return '';
    if (field.hasError('required')) return 'Confirm password is required';
    if (this.newPasswordForm.hasError('passwordMismatch')) return 'Passwords do not match';
    return '';
  }

  getFieldError(fieldName: string): string {
    const field = this.newPasswordForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'New password is required';
    if (field.errors['minlength']) {
      return `Password must be at least ${field.errors['minlength'].requiredLength} characters`;
    }

    return '';
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('newPassword');
    const confirmPassword = group.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }
}
