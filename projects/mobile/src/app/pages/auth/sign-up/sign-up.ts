import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonRouterLink,
  IonSpinner,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAddOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import {
  APP_HOME_URL,
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  RegisterRequest,
  apiErrorMessage,
  isFieldInvalid,
  resolveReturnUrl,
  signUpSchema,
} from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Notice } from '../../../_shared/components/notice/notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { focusFirstInvalidIonic } from '../../../_shared/utils/focus-first-invalid';
import { TermsNotice } from '../_components/terms-notice/terms-notice';

@Component({
  selector: 'mh-sign-up',
  imports: [
    FormField,
    FormRoot,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonLabel,
    IonRouterLink,
    IonSpinner,
    IonToolbar,
    RouterLink,
    TranslatePipe,
    FieldErrorPipe,
    GuestControls,
    Notice,
    PasswordInput,
    TermsNotice,
  ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  /** Forwarded to the sign-in link so returnUrl survives the switch. */
  protected readonly queryParams: Params = this._activatedRoute.snapshot.queryParams;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly model = signal({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    isInstructor: false,
  });
  protected readonly form = form(this.model, signUpSchema, {
    submission: { action: async () => this.register(), onInvalid: focusFirstInvalidIonic },
  });

  constructor() {
    addIcons({ personAddOutline });
  }

  private register(): void {
    const { firstName, lastName, email, password, confirmPassword, isInstructor } = this.model();
    const request: RegisterRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password,
      confirmPassword,
      isInstructor: isInstructor || undefined,
    };

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._authService
      .register(request)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.navigateToApp(),
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.signUp.error')),
          ),
      });
  }

  private navigateToApp(): void {
    void this._navController.navigateRoot(
      resolveReturnUrl(this._activatedRoute.snapshot.queryParamMap, this._appHomeUrl),
    );
  }
}
