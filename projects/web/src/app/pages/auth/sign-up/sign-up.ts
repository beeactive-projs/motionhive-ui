import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, apply, disabled, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, finalize } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import {
  AUTH_FIELD_ERRORS,
  AuthService,
  AuthStore,
  ClientInviteService,
  FieldErrorPipe,
  RegisterRequest,
  STORAGE_KEYS,
  ScheduledDeletion,
  apiErrorMessage,
  focusFirstInvalid,
  isFieldInvalid,
  resolveReturnUrl,
  scheduledDeletionFrom,
  signUpSchema,
} from 'core';
import { AcceptInvite } from '../_components/accept-invite/accept-invite';
import { AuthHeader } from '../_components/auth-header/auth-header';
import { KeepAccountOffer } from '../_components/keep-account-offer/keep-account-offer';
import { SocialSignIn } from '../_components/social-sign-in/social-sign-in';
import { TermsNotice } from '../_components/terms-notice/terms-notice';
import { INVITE_ACCEPTED_URL } from '../auth.const';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';

/**
 * Sign up, which is also where two kinds of link land:
 * - a client invite (`?token=`): the email is fixed to the invited one, and
 *   the invite is accepted once the account exists. Someone already signed in
 *   gets the accept card instead of the form;
 * - a friend referral (`?ref=<userId>`): kept until sign up succeeds. The API
 *   doesn't record referrals yet, so this only carries the value end to end.
 * The invite survives a detour to sign in and back in the query params; the
 * referral is stored.
 */
@Component({
  selector: 'mh-sign-up',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    Checkbox,
    InputText,
    Message,
    PasswordInput,
    FieldErrorPipe,
    AcceptInvite,
    AuthHeader,
    KeepAccountOffer,
    SocialSignIn,
    TermsNotice,
  ],
  providers: [ClientInviteService],
  templateUrl: './sign-up.html',
})
export class SignUp {
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _clientInviteService = inject(ClientInviteService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);

  /** Carried over to sign in, so a return URL or invite survives the switch. */
  protected readonly queryParams = this._activatedRoute.snapshot.queryParams;
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
    this._authStore.isAuthenticated() && !!this._clientInviteService.token,
  );

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** The account is in its deletion cooling-off: offer to keep it. */
  protected readonly keepOffer = signal<ScheduledDeletion | null>(null);

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
    // Only an invite in the URL counts, never one remembered from an earlier
    // visit: on a shared device that could be somebody else's.
    if (this._invitationToken) this.loadInvitation(this._invitationToken);

    const referrer = this._activatedRoute.snapshot.queryParamMap.get('ref');
    if (referrer) {
      localStorage.setItem(STORAGE_KEYS.FRIEND_REFERRER_ID, referrer);
    }
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

  private loadInvitation(token: string): void {
    this._clientInviteService.load(token).subscribe({
      next: (details) => this.model.update((value) => ({ ...value, email: details.invitedEmail })),
      error: () =>
        this.errorMessage.set(
          this._translateService.instant('auth.signUp.error.invalidInvitation'),
        ),
    });
  }

  private signUp(request: Observable<unknown>, fallbackKey: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.keepOffer.set(null);
    request.pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: () => this.acceptInvitationAndNavigate(),
      error: (err: unknown) => {
        const offer = scheduledDeletionFrom(err);
        if (offer) {
          this.keepOffer.set(offer);
          return;
        }
        this.errorMessage.set(apiErrorMessage(err, this._translateService.instant(fallbackKey)));
      },
    });
  }

  protected onKept(): void {
    this.keepOffer.set(null);
    this.acceptInvitationAndNavigate();
  }

  protected onKeepExpired(): void {
    this.keepOffer.set(null);
    this.errorMessage.set(this._translateService.instant('auth.keepAccount.expired'));
  }

  private acceptInvitationAndNavigate(): void {
    localStorage.removeItem(STORAGE_KEYS.FRIEND_REFERRER_ID);

    const token = this._invitationToken;
    if (!token) {
      this.navigateIn();
      return;
    }
    this._clientInviteService.accept(token).subscribe({
      next: () => void this._router.navigateByUrl(INVITE_ACCEPTED_URL),
      error: () => this.navigateIn(),
    });
  }

  /** A new account starts on its profile, to fill it in, rather than at home. */
  private navigateIn(): void {
    void this._router.navigateByUrl(
      resolveReturnUrl(this._activatedRoute.snapshot.queryParamMap, '/profile'),
    );
  }
}
