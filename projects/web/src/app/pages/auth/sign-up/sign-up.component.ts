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
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { Divider } from 'primeng/divider';

// Core imports
import {
  AuthService,
  AuthStore,
  FacebookAuthService,
  GoogleAuthService,
  RegisterRequest,
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
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly googleAuthService = inject(GoogleAuthService);
  private readonly facebookAuthService = inject(FacebookAuthService);
  private readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);

  // Signals for component state
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Reactive form
  registerForm: FormGroup = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      // confirmPassword: ['', [Validators.required]],
      // agreeToTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: this.passwordMatchValidator,
    },
  );

  // Custom validator for password match
  private passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  private readonly googleBtnContainer = viewChild<ElementRef>('googleBtn');

  constructor() {
    afterNextRender(() => {
      const el = this.googleBtnContainer()?.nativeElement;
      if (el) {
        this.googleAuthService.renderButton(
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
    this.successMessage.set(null);

    const data: RegisterRequest = {
      firstName: this.registerForm.value.firstName,
      lastName: this.registerForm.value.lastName,
      email: this.registerForm.value.email,
      phone: this.registerForm.value.phone || undefined,
      password: this.registerForm.value.password,
      confirmPassword: this.registerForm.value.confirmPassword,
    };

    this.authService.register(data).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToDashboard();
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

    this.authService.googleLogin({ idToken }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToDashboard();
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

    this.facebookAuthService
      .signIn()
      .then((accessToken: string) => {
        this.authService.facebookLogin({ accessToken }).subscribe({
          next: () => {
            this.isLoading.set(false);
            this.navigateToDashboard();
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

  // Helper methods for validation
  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    return !!(
      this.registerForm.hasError('passwordMismatch') &&
      this.registerForm.get('confirmPassword')?.touched
    );
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
    if (field.errors['pattern'] && fieldName === 'phone') {
      return 'Please enter a valid phone number';
    }

    return '';
  }

  private navigateToDashboard(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    if (this.authStore.isOrganizer()) {
      this.router.navigate(['/app/dashboard']);
    } else if (this.authStore.isParticipant()) {
      this.router.navigate(['/app/client/dashboard/']);
    } else {
      this.router.navigate(['/app/dashboard']);
    }
  }

  private capitalize(str: string): string {
    if (str === 'firstName') return 'First name';
    if (str === 'lastName') return 'Last name';
    if (str === 'confirmPassword') return 'Confirm password';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
