import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonLabel,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, RegisterRequest, UserService, validationMessage } from 'core';

@Component({
  selector: 'mh-sign-up',
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonInput,
    IonInputPasswordToggle,
    IonLabel,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _userService = inject(UserService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  registerForm: FormGroup = this._formBuilder.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, this.strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
      isInstructor: [false],
    },
    { validators: this.passwordMatchValidator },
  );

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { firstName, lastName, email, password, confirmPassword, isInstructor } =
      this.registerForm.getRawValue();
    const data: RegisterRequest = {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      isInstructor: isInstructor || undefined,
    };

    this._authService.register(data).subscribe({
      next: () => {
        this.isLoading.set(false);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this._userService.updateMe({ timezone }).subscribe({ error: () => {} });
        this.navigateToApp();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || this._translateService.instant('auth.signUp.error'),
        );
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  isConfirmPasswordInvalid(): boolean {
    const field = this.registerForm.get('confirmPassword');
    if (!field || !(field.dirty || field.touched)) return false;
    return field.hasError('required') || this.registerForm.hasError('passwordMismatch');
  }

  /** The control's own error first (required), then the group-level mismatch. */
  getConfirmPasswordError(): string {
    const errors = this.registerForm.get('confirmPassword')?.errors ?? this.registerForm.errors;
    return validationMessage(errors, { required: 'auth.signUp.confirmPasswordRequired' });
  }

  getFieldError(fieldName: string): string {
    return validationMessage(this.registerForm.get(fieldName)?.errors);
  }

  private strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const value: string = control.value ?? '';
    if (!value) return null;
    const valid =
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(value);
    return valid ? null : { passwordStrength: true };
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  private navigateToApp(): void {
    const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
    this._navController.navigateRoot(returnUrl || '/tabs/home');
  }
}
