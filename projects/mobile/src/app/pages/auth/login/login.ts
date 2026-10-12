import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonRouterLink,
  IonSpinner,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import {
  APP_HOME_URL,
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  isFieldInvalid,
  resolveReturnUrl,
  signInSchema,
} from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Logo } from '../../../_shared/components/logo/logo';
import { Notice } from '../../../_shared/components/notice/notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { focusFirstInvalidIonic } from '../../../_shared/utils/focus-first-invalid';
import { TermsNotice } from '../_components/terms-notice/terms-notice';

@Component({
  selector: 'mh-login',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonRouterLink,
    IonSpinner,
    IonToolbar,
    TranslatePipe,
    FieldErrorPipe,
    GuestControls,
    Logo,
    Notice,
    PasswordInput,
    TermsNotice,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  /** Forwarded to the sign-up link so returnUrl survives the switch. */
  protected readonly queryParams: Params = this._activatedRoute.snapshot.queryParams;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly model = signal({ email: '', password: '' });
  protected readonly form = form(this.model, signInSchema, {
    submission: { action: async () => this.signIn(), onInvalid: focusFirstInvalidIonic },
  });

  constructor() {
    addIcons({ arrowForward });
  }

  private signIn(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._authService
      .login(this.model())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.navigateToApp(),
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.login.error')),
          ),
      });
  }

  private navigateToApp(): void {
    void this._navController.navigateRoot(
      resolveReturnUrl(this._activatedRoute.snapshot.queryParamMap, this._appHomeUrl),
    );
  }
}
