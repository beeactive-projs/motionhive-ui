import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonRouterLink,
  IonSpinner,
  IonText,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, LoginRequest, validationMessage } from 'core';

@Component({
  selector: 'mh-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonRouterLink,
    IonSpinner,
    IonText,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Forwarded to the sign-up link so returnUrl survives the switch. */
  readonly queryParams: Params = this._route.snapshot.queryParams;

  loginForm: FormGroup = this._formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
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
    };

    this._authService.login(credentials).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.navigateToApp();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || this._translateService.instant('auth.login.error'),
        );
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    return validationMessage(this.loginForm.get(fieldName)?.errors);
  }

  private navigateToApp(): void {
    const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
    this._navController.navigateRoot(returnUrl || '/tabs/home');
  }
}
