import { Component, signal, inject, ChangeDetectionStrategy, afterNextRender, viewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

// Core imports
import { AuthService, AuthStore, FacebookAuthService, GoogleAuthService, LoginRequest } from 'core';
import { Divider } from 'primeng/divider';
import { ThemeService } from '../../../_core/services/theme.service';
import { ThemeToggleComponent } from "../../../_shared/components/theme-toggle/theme-toggle.component";

@Component({
  selector: 'bee-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    MessageModule,
    IconFieldModule,
    InputIconModule,
    Divider,
    ThemeToggleComponent
],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _googleAuthService = inject(GoogleAuthService);
  private readonly _facebookAuthService = inject(FacebookAuthService);
  private readonly _router = inject(Router);
  private readonly _themeService = inject(ThemeService);
  protected readonly _route = inject(ActivatedRoute);

  // Signals for component state
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  // Reactive form
  loginForm: FormGroup = this._formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    // rememberMe: [false],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials: LoginRequest = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      // rememberMe: this.loginForm.value.rememberMe,
    };

    this._authService.login(credentials).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToDashboard();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || 'Invalid email or password. Please try again.',
        );
      },
    });
  }

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

  private onGoogleCredential(idToken: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._authService.googleLogin({ idToken }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToDashboard();
      },
      error: (error: { error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || 'Google sign-in failed. Please try again.',
        );
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
            this.navigateToDashboard();
          },
          error: (error: { error?: { message?: string } }) => {
            this.isLoading.set(false);
            this.errorMessage.set(
              error.error?.message || 'Facebook sign-in failed. Please try again.',
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
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `${this.capitalize(fieldName)} is required`;
    if (field.errors['email']) return 'Please enter a valid email address';
    if (field.errors['minlength']) {
      return `${this.capitalize(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
    }

    return '';
  }

  private navigateToDashboard(): void {
    const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this._router.navigateByUrl(returnUrl);
      return;
    }

    if (this._authStore.isInstructor()) {
      this._router.navigate(['/app/dashboard']);
    } else if (this._authStore.isUser()) {
      this._router.navigate(['/app/client/dashboard/']);
    } else {
      this._router.navigate(['/app/dashboard']);
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
