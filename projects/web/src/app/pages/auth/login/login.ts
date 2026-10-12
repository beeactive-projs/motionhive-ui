import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, finalize } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import {
  APP_HOME_URL,
  AUTH_FIELD_ERRORS,
  AuthService,
  FieldErrorPipe,
  apiErrorMessage,
  focusFirstInvalid,
  isFieldInvalid,
  resolveReturnUrl,
  signInSchema,
} from 'core';
import { AuthHeader } from '../_components/auth-header/auth-header';
import { SocialSignIn } from '../_components/social-sign-in/social-sign-in';
import { TermsNotice } from '../_components/terms-notice/terms-notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { ClientInviteService } from '../_services/client-invite.service';

/**
 * Sign in. Reached from a client invite's sign-up page too (`?token=` carried
 * over): it then names the inviting coach and accepts the invite once signed
 * in. Only an invite in the URL counts, never a stored one, so whoever signs
 * in on a shared device can't accept somebody else's invite by accident.
 */
@Component({
  selector: 'mh-login',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    InputText,
    Message,
    PasswordInput,
    FieldErrorPipe,
    AuthHeader,
    SocialSignIn,
    TermsNotice,
  ],
  providers: [ClientInviteService],
  templateUrl: './login.html',
})
export class Login {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _clientInviteService = inject(ClientInviteService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  /** Carried over to sign up, so a return URL or invite survives the switch. */
  protected readonly queryParams = this._activatedRoute.snapshot.queryParams;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly invite = this._clientInviteService.details;
  protected readonly inviteInvalid = this._clientInviteService.invalid;
  protected readonly coachName = this._clientInviteService.coachName;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly model = signal({ email: '', password: '' });
  protected readonly form = form(this.model, signInSchema, {
    submission: {
      action: async () =>
        this.signIn(this._authService.login(this.model()), 'auth.login.error.invalidCredentials'),
      onInvalid: focusFirstInvalid,
    },
  });

  constructor() {
    const token = this._clientInviteService.token;
    if (token) this._clientInviteService.load(token).subscribe({ error: () => undefined });
  }

  protected onGoogleCredential(idToken: string): void {
    this.signIn(this._authService.googleLogin({ idToken }), 'auth.common.googleFailed');
  }

  protected onGoogleFailed(): void {
    this.errorMessage.set(this._translateService.instant('auth.common.googleFailed'));
  }

  private signIn(request: Observable<unknown>, fallbackKey: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    request.pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: () => this.acceptInviteAndNavigate(),
      error: (err) =>
        this.errorMessage.set(apiErrorMessage(err, this._translateService.instant(fallbackKey))),
    });
  }

  /** With a valid invite in the URL, accept it and show the new coach; else carry on. */
  private acceptInviteAndNavigate(): void {
    const token = this._clientInviteService.token;
    if (!token || this.inviteInvalid()) {
      this.navigateIn();
      return;
    }
    this._clientInviteService.accept(token).subscribe({
      next: () => void this._clientInviteService.openCoaches(),
      error: () => this.navigateIn(),
    });
  }

  private navigateIn(): void {
    void this._router.navigateByUrl(
      resolveReturnUrl(this._activatedRoute.snapshot.queryParamMap, this._appHomeUrl),
    );
  }
}
