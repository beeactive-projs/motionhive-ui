import { Component, signal, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonDirective } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

// Core imports
import { AuthService, Logo, validationMessage } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-new-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    PasswordModule,
    MessageModule,
    ThemeToggleComponent,
    Logo,
    TranslatePipe,
  ],
  templateUrl: './new-password.component.html',
  styleUrl: './new-password.component.scss',
})
export class NewPasswordComponent implements OnInit {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  hasToken = signal(false);
  private token = '';

  newPasswordForm: FormGroup = this._formBuilder.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: this.passwordMatchValidator,
    },
  );

  ngOnInit(): void {
    this._route.queryParamMap.subscribe((params) => {
      this.token = params.get('token') ?? '';
      this.hasToken.set(!!this.token);
      if (!this.token) {
        this.errorMessage.set(
          this._translateService.instant('auth.newPassword.error.missingToken'),
        );
      }
    });
  }

  private passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

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
        token: this.token,
        newPassword: this.newPasswordForm.value.newPassword,
        confirmPassword: this.newPasswordForm.value.confirmPassword,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.successMessage.set(this._translateService.instant('auth.newPassword.success'));
          setTimeout(() => {
            this._router.navigate(['/auth/login']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error.error?.message ||
              this._translateService.instant('auth.newPassword.error.resetFailed'),
          );
        },
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.newPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    return !!(
      this.newPasswordForm.hasError('passwordMismatch') &&
      this.newPasswordForm.get('confirmPassword')?.touched
    );
  }

  getFieldError(fieldName: string): string {
    return validationMessage(this.newPasswordForm.get(fieldName)?.errors);
  }
}
