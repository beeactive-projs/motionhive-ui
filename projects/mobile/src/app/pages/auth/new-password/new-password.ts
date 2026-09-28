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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, validationMessage } from 'core';

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
    TranslatePipe,
  ],
  templateUrl: './new-password.html',
  styleUrl: './new-password.scss',
})
export class NewPassword {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);

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
          this.successMessage.set(this._translateService.instant('auth.newPassword.success'));
          setTimeout(() => {
            this._navController.navigateRoot('/auth/login');
          }, 2000);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error.error?.message || this._translateService.instant('auth.newPassword.error'),
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

  /** The control's own error first (required), then the group-level mismatch. */
  getConfirmPasswordError(): string {
    return validationMessage(
      this.newPasswordForm.get('confirmPassword')?.errors ?? this.newPasswordForm.errors,
    );
  }

  getFieldError(fieldName: string): string {
    return validationMessage(this.newPasswordForm.get(fieldName)?.errors);
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
