import { Component, computed, inject, signal } from '@angular/core';
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
import { chevronForwardOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import {
  APP_HOME_URL,
  AUTH_FIELD_ERRORS,
  AuthService,
  ClientInviteService,
  FieldErrorPipe,
  ScheduledDeletion,
  apiErrorMessage,
  appLocale,
  focusFirstInvalid,
  isFieldInvalid,
  resolveReturnUrl,
  scheduledDeletionFrom,
  signInSchema,
} from 'core';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { AuthHeader } from '../_components/auth-header/auth-header';
import { Logo } from '../../../_shared/components/logo/logo';
import { Notice } from '../../../_shared/components/notice/notice';
import { PasswordInput } from '../../../_shared/components/password-input/password-input';
import { TermsNotice } from '../_components/terms-notice/terms-notice';
import { InviteLandingService } from '../invite-landing.service';

/**
 * Sign in. Reached from a client invite's sign-up page too (`?token=` carried
 * over): it then names the inviting coach and accepts the invite once signed
 * in.
 */
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
    AuthHeader,
    ConfirmSheet,
    GuestControls,
    Logo,
    Notice,
    PasswordInput,
    TermsNotice,
  ],
  providers: [ClientInviteService],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);
  private readonly _clientInviteService = inject(ClientInviteService);
  private readonly _inviteLandingService = inject(InviteLandingService);

  /** Forwarded to the sign-up link so a return URL or invite survives the switch. */
  protected readonly queryParams: Params = this._activatedRoute.snapshot.queryParams;
  protected readonly isInvalid = isFieldInvalid;
  protected readonly fieldErrors = AUTH_FIELD_ERRORS;

  protected readonly invite = this._clientInviteService.details;
  protected readonly inviteInvalid = this._clientInviteService.invalid;
  protected readonly coachName = this._clientInviteService.coachName;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * The account is in its deletion cooling-off: the password was right, and
   * the API offers to keep it instead of signing in.
   */
  protected readonly keepOffer = signal<ScheduledDeletion | null>(null);
  protected readonly keepOpen = signal(false);
  protected readonly keeping = signal(false);
  protected readonly keepDate = computed(() => {
    const offer = this.keepOffer();
    return offer
      ? new Date(offer.scheduledFor).toLocaleDateString(appLocale(), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  protected readonly model = signal({ email: '', password: '' });
  protected readonly form = form(this.model, signInSchema, {
    submission: { action: async () => this.signIn(), onInvalid: focusFirstInvalid },
  });

  constructor() {
    addIcons({ chevronForwardOutline });
    const token = this._clientInviteService.token;
    if (token) this._clientInviteService.load(token).subscribe({ error: () => undefined });
  }

  private signIn(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._authService
      .login(this.model())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.acceptInviteAndNavigate(),
        error: (err: unknown) => {
          const offer = scheduledDeletionFrom(err);
          if (offer) {
            this.keepOffer.set(offer);
            this.keepOpen.set(true);
            return;
          }
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.login.error.invalidCredentials')),
          );
        },
      });
  }

  /** Keep the account: the deletion is cancelled and they are signed in. */
  protected keepAccount(): void {
    const offer = this.keepOffer();
    if (!offer || this.keeping()) return;
    this.keeping.set(true);
    this._authService
      .restoreAccount(offer.restoreTicket)
      .pipe(finalize(() => this.keeping.set(false)))
      .subscribe({
        next: () => {
          this.keepOpen.set(false);
          this.acceptInviteAndNavigate();
        },
        error: () => {
          // The ticket lasts 15 minutes; signing in again issues a new one.
          this.keepOpen.set(false);
          this.keepOffer.set(null);
          this.errorMessage.set(this._translateService.instant('auth.keepAccount.expired'));
        },
      });
  }

  /** With a valid invite in the URL, accept it; else carry on into the app. */
  private acceptInviteAndNavigate(): void {
    const token = this._clientInviteService.token;
    if (!token || this.inviteInvalid()) {
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
