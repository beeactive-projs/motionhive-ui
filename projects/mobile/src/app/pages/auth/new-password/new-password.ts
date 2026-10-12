import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonSpinner,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmark, sendOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, timer } from 'rxjs';

import {
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  isFieldInvalid,
  newPasswordSchema,
} from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Notice } from '../../../_shared/components/notice/notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { focusFirstInvalidIonic } from '../../../_shared/utils/focus-first-invalid';

/**
 * Sets a new password from the emailed reset link. Reachable only with a
 * `?token=` query param — until deep links land, that means opening the
 * link in the app manually; the page is part of v1 auth so the flow is
 * complete when deep linking arrives.
 */
@Component({
  selector: 'mh-new-password',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonSpinner,
    IonToolbar,
    TranslatePipe,
    FieldErrorPipe,
    GuestControls,
    Notice,
    PasswordInput,
  ],
  templateUrl: './new-password.html',
  styleUrl: './new-password.scss',
})
export class NewPassword {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _token = this._activatedRoute.snapshot.queryParamMap.get('token') ?? '';
  protected readonly hasToken = !!this._token;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly model = signal({ newPassword: '', confirmPassword: '' });
  protected readonly form = form(this.model, newPasswordSchema, {
    submission: { action: async () => this.save(), onInvalid: focusFirstInvalidIonic },
  });

  constructor() {
    addIcons({ checkmark, sendOutline });
  }

  private save(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._authService
      .resetPassword({ token: this._token, ...this.model() })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.done.set(true);
          timer(2000)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => void this._navController.navigateRoot('/auth/login'));
        },
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.newPassword.error')),
          ),
      });
  }
}
