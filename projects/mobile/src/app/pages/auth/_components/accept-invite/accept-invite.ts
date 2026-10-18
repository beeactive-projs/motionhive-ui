import { Component, computed, inject, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForwardOutline, checkmarkOutline, logOutOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { APP_HOME_URL, AuthService, AuthStore, ClientInviteService, apiErrorMessage } from 'core';
import { Notice } from '../../../../_shared/components/notice/notice';
import { InviteLandingService } from '../../invite-landing.service';
import { AuthHeader } from '../auth-header/auth-header';

/**
 * What a signed-in user sees on a client invite link, in place of the sign-up
 * form: who they are signed in as, the coach who invited them, and a choice to
 * accept with this account or sign out and use another. Needs the page's
 * `ClientInviteService`. The web app's `mh-accept-invite`.
 */
@Component({
  selector: 'mh-accept-invite',
  imports: [IonButton, IonIcon, IonSpinner, TranslatePipe, AuthHeader, Notice],
  templateUrl: './accept-invite.html',
  styleUrl: './accept-invite.scss',
})
export class AcceptInvite {
  private readonly _clientInviteService = inject(ClientInviteService);
  private readonly _inviteLandingService = inject(InviteLandingService);
  private readonly _authService = inject(AuthService);
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);
  private readonly _navController = inject(NavController);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  protected readonly userName = this._authStore.userName;
  protected readonly userEmail = computed(() => this._authStore.user()?.email ?? '');
  protected readonly invite = this._clientInviteService.details;
  protected readonly invalid = this._clientInviteService.invalid;
  protected readonly coachName = this._clientInviteService.coachName;
  /** The address the invite went to, when it isn't the signed-in account's. */
  protected readonly otherAddress = computed(() => {
    const invitedEmail = this.invite()?.invitedEmail;
    return invitedEmail && invitedEmail.toLowerCase() !== this.userEmail().toLowerCase()
      ? invitedEmail
      : null;
  });

  /** The user signed out to use another account. */
  readonly signedOut = output<void>();

  protected readonly isAccepting = signal(false);
  protected readonly isSigningOut = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    addIcons({ arrowForwardOutline, checkmarkOutline, logOutOutline });
  }

  protected accept(): void {
    const token = this._clientInviteService.token;
    if (!token) return;
    this.isAccepting.set(true);
    this.errorMessage.set(null);
    this._clientInviteService
      .accept(token)
      .pipe(finalize(() => this.isAccepting.set(false)))
      .subscribe({
        next: () => void this._inviteLandingService.open(),
        error: (err) =>
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.invite.acceptFailed')),
          ),
      });
  }

  /**
   * Signs out, so the page can show the sign-up form (with its link to sign
   * in). A failed request still ends the local session, so it counts too.
   */
  protected signOut(): void {
    this.isSigningOut.set(true);
    this.errorMessage.set(null);
    this._authService
      .logout()
      .pipe(finalize(() => this.isSigningOut.set(false)))
      .subscribe({
        next: () => this.signedOut.emit(),
        error: () => this.signedOut.emit(),
      });
  }

  protected goToApp(): void {
    void this._navController.navigateRoot(this._appHomeUrl);
  }
}
