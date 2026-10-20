import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, apply, disabled, form } from '@angular/forms/signals';
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
import { Observable, finalize } from 'rxjs';

import {
  APP_HOME_URL,
  AUTH_FIELD_ERRORS,
  AuthService,
  AuthStore,
  ClientInviteService,
  FieldErrorPipe,
  RegisterRequest,
  apiErrorMessage,
  focusFirstInvalid,
  isFieldInvalid,
  resolveReturnUrl,
  signUpSchema,
} from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Notice } from '../../../_shared/components/notice/notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { AcceptInvite } from '../_components/accept-invite/accept-invite';
import { AuthHeader } from '../_components/auth-header/auth-header';
import { SocialSignIn } from '../_components/social-sign-in/social-sign-in';
import { TermsNotice } from '../_components/terms-notice/terms-notice';
import { InviteLandingService } from '../invite-landing.service';

/**
 * Sign up, which is also where a coach's client invite lands (`?token=`): the
 * email is fixed to the invited one, and the invite is accepted once the
 * account exists. Someone already signed in gets the accept card instead of
 * the form. Google sign-up is the same call as Google sign-in: it makes the
 * account when there is none.
 */
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
    AcceptInvite,
    AuthHeader,
    GuestControls,
    Notice,
    PasswordInput,
    SocialSignIn,
    TermsNotice,
  ],
  providers: [ClientInviteService],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp {
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _clientInviteService = inject(ClientInviteService);
  private readonly _inviteLandingService = inject(InviteLandingService);
  private readonly _navController = inject(NavController);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  /** Forwarded to the sign-in link so a return URL or invite survives the switch. */
  protected readonly queryParams: Params = this._activatedRoute.snapshot.queryParams;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  private readonly _invitationToken = this._clientInviteService.token;
  protected readonly invitation = this._clientInviteService.details;
  protected readonly coachName = this._clientInviteService.coachName;
  protected readonly hasInvitation = !!this._invitationToken;
  /**
   * Arrived signed in on an invite link: show the accept card, not the form.
   * Decided on arrival, so a sign up that succeeds here doesn't flip to it.
   */
  protected readonly showAcceptInvite = signal(
    this._authStore.isAuthenticated() && this.hasInvitation,
  );

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
  protected readonly form = form(
    this.model,
    (p) => {
      apply(p, signUpSchema);
      // An invite fixes the address to the one it was sent to.
      disabled(p.email, () => this.invitation() !== null);
    },
    { submission: { action: async () => this.register(), onInvalid: focusFirstInvalid } },
  );

  constructor() {
    addIcons({ personAddOutline });
    if (this._invitationToken) this.loadInvitation(this._invitationToken);
  }

  protected onSignedOut(): void {
    this.showAcceptInvite.set(false);
  }

  private register(): void {
    const { firstName, lastName, email, password, confirmPassword, isInstructor } = this.model();
    const request: RegisterRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password,
      confirmPassword,
      // An invited client joins as a client; the coach option isn't offered.
      isInstructor: this.hasInvitation ? false : isInstructor || undefined,
    };

    this.signUp(this._authService.register(request), 'auth.signUp.error.registrationFailed');
  }

  protected onGoogleCredential(idToken: string): void {
    this.signUp(this._authService.googleLogin({ idToken }), 'auth.common.googleFailed');
  }

  protected onGoogleFailed(): void {
    this.errorMessage.set(this._translateService.instant('auth.common.googleFailed'));
  }

  private signUp(request: Observable<unknown>, fallbackKey: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    request.pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: () => this.acceptInvitationAndNavigate(),
      error: (err: unknown) =>
        this.errorMessage.set(apiErrorMessage(err, this._translateService.instant(fallbackKey))),
    });
  }

  private loadInvitation(token: string): void {
    this._clientInviteService.load(token).subscribe({
      next: (details) => this.model.update((value) => ({ ...value, email: details.invitedEmail })),
      error: () =>
        this.errorMessage.set(this._translateService.instant('auth.signUp.error.invalidInvitation')),
    });
  }

  /** With an invite in the URL, accept it for the new account; else carry on into the app. */
  private acceptInvitationAndNavigate(): void {
    const token = this._invitationToken;
    if (!token) {
      this.navigateToApp();
      return;
    }
    this._clientInviteService.accept(token).subscribe({
      next: () => void this._inviteLandingService.open(),
      error: () => this.navigateToApp(),
    });
  }

  private navigateToApp(): void {
    void this._navController.navigateRoot(
      resolveReturnUrl(this._activatedRoute.snapshot.queryParamMap, this._appHomeUrl),
    );
  }
}
