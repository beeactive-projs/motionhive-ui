import {
  Component,
  signal,
  inject,
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { Divider } from 'primeng/divider';
import {
  AuthService,
  AuthStore,
  FacebookAuthService,
  GoogleAuthService,
  RegisterRequest,
  UserRoles,
  UserService,
} from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'bee-sign-up',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    MessageModule,
    Divider,
    ThemeToggleComponent,
  ],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpComponent {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _googleAuthService = inject(GoogleAuthService);
  private readonly _facebookAuthService = inject(FacebookAuthService);
  private readonly _userService = inject(UserService);
  private readonly _router = inject(Router);
  protected readonly _route = inject(ActivatedRoute);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  registerForm: FormGroup = this._formBuilder.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)]],
      password: ['', [Validators.required, this.strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
      isInstructor: [false],
    },
    { validators: this.passwordMatchValidator },
  );

  private readonly googleBtnContainer = viewChild<ElementRef>('googleBtn');

  constructor() {
    afterNextRender(() => {
      const el = this.googleBtnContainer()?.nativeElement;
      if (el) {
        this._googleAuthService.renderButton(
          el,
          (idToken) => this.onGoogleCredential(idToken),
          (error) => this.errorMessage.set(error.message),
        );
      }
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { firstName, lastName, email, phone, password, confirmPassword, isInstructor } =
      this.registerForm.value;
    const data: RegisterRequest = {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
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
        this.errorMessage.set(error.error?.message || 'Registration failed. Please try again.');
      },
    });
  }

  private onGoogleCredential(idToken: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._authService.googleLogin({ idToken }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToApp();
      },
      error: (error: { error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.error?.message || 'Google sign-in failed. Please try again.');
      },
    });
  }

  onFacebookLogin(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._facebookAuthService
      .signIn()
      .then((accessToken: string) => {
        this._authService.facebookLogin({ accessToken }).subscribe({
          next: () => {
            this.isLoading.set(false);
            this.navigateToApp();
          },
          error: (error: { error?: { message?: string } }) => {
            this.isLoading.set(false);
            this.errorMessage.set(
              error.error?.message || 'Facebook sign-up failed. Please try again.',
            );
          },
        });
      })
      .catch(() => {
        this.isLoading.set(false);
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

  getConfirmPasswordError(): string {
    const field = this.registerForm.get('confirmPassword');
    if (!field) return '';
    if (field.hasError('required')) return 'Please confirm your password';
    if (this.registerForm.hasError('passwordMismatch')) return 'Passwords do not match';
    return '';
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `${this.capitalize(fieldName)} is required`;
    if (field.errors['email']) return 'Please enter a valid email address';
    if (field.errors['minlength']) {
      const minLength = field.errors['minlength'].requiredLength;
      return `${this.capitalize(fieldName)} must be at least ${minLength} characters`;
    }
    if (field.errors['passwordStrength']) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }
    if (field.errors['pattern'] && fieldName === 'phone') {
      return 'Please enter a valid phone number';
    }

    return '';
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
    if (returnUrl) {
      this._router.navigateByUrl(returnUrl);
      return;
    }

    if (this._authStore.hasRole(UserRoles.Instructor)) {
      this._router.navigate(['/app/profile']);
    } else {
      this._router.navigate(['/app/client/profile']);
    }
  }

  private capitalize(str: string): string {
    if (str === 'firstName') return 'First name';
    if (str === 'lastName') return 'Last name';
    if (str === 'confirmPassword') return 'Confirm password';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
