import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  AuthService,
  AuthStore,
  LoginRequest,
  UserRoles,
  showApiError,
} from 'core';

/**
 * Admin sign-in. Reuses core AuthService (same login endpoint + token
 * handling as the web app). After login we verify the account actually
 * holds an admin role before letting them in — a non-admin who logs in
 * here is signed straight back out.
 */
@Component({
  selector: 'mh-admin-login',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly _fb = inject(FormBuilder);
  private readonly _auth = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _messages = inject(MessageService);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this._fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);

    this._auth.login(this.form.getRawValue() as LoginRequest).subscribe({
      next: () => {
        const roles = this._authStore.userRoles();
        const isAdmin =
          roles.includes(UserRoles.Admin) || roles.includes(UserRoles.SuperAdmin);
        if (!isAdmin) {
          this._auth.logout().subscribe();
          this.submitting.set(false);
          this.error.set('This account does not have admin access.');
          return;
        }
        this._router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set('Invalid email or password.');
        showApiError(this._messages, 'Sign in failed', 'Invalid credentials', err);
      },
    });
  }
}
