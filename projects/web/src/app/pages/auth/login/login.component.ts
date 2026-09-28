import {
  Component,
  signal,
  inject,
  afterNextRender,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

// Core imports
import {
  AuthService,
  AuthStore,
  FacebookAuthService,
  GoogleAuthService,
  LoginRequest,
  Logo,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  ThemeService,
  validationMessage,
} from 'core';
import { Divider } from 'primeng/divider';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    MessageModule,
    IconFieldModule,
    InputIconModule,
    Divider,
    ThemeToggleComponent,
    Logo,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _googleAuthService = inject(GoogleAuthService);
  private readonly _facebookAuthService = inject(FacebookAuthService);
  private readonly _router = inject(Router);
  private readonly _themeService = inject(ThemeService);
  private readonly _translateService = inject(TranslateService);
  protected readonly _route = inject(ActivatedRoute);

  // Legal pages live on the marketing site — link out absolutely (the app
  // has no /legal routes).
  protected readonly termsUrl = TERMS_OF_SERVICE_URL;
  protected readonly privacyUrl = PRIVACY_POLICY_URL;

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
          error.error?.message ||
            this._translateService.instant('auth.login.error.invalidCredentials'),
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
          error.error?.message || this._translateService.instant('auth.common.googleFailed'),
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
              error.error?.message ||
                this._translateService.instant('auth.login.error.facebookFailed'),
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
    return validationMessage(this.loginForm.get(fieldName)?.errors);
  }

  private navigateToDashboard(): void {
    const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this._router.navigateByUrl(returnUrl);
      return;
    }

    this._router.navigate(['/home']);
  }
}
