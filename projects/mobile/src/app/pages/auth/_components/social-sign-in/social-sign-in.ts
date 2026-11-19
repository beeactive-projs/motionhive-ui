import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AppleLoginRequest, FacebookLoginRequest } from 'core';

import { AppleSignInCancelled, AppleSignInService } from '../../apple-sign-in.service';
import { FacebookSignInCancelled, FacebookSignInService } from '../../facebook-sign-in.service';
import { GoogleSignInCancelled, GoogleSignInService } from '../../google-sign-in.service';

/**
 * The "or" divider, then "Continue with Google", "Continue with Apple" and
 * "Continue with Facebook" under the sign in and sign up forms, as on web.
 * Each provider shows only where it works; with none, nothing shows. Closing
 * a provider's sheet is not an error, and while one sheet is open every
 * button waits.
 *
 * Every button is ours, drawn to its provider's rules at one size, so none
 * outranks another. Google: the four colour mark on a neutral outlined
 * button (the app opens the native account picker, not Google's web
 * button). Apple, on iPhone only (see `AppleSignInService`): the logo and
 * title in one colour, black on the light theme and white on the dark one.
 * Facebook, on iPhone and Android (see `FacebookSignInService`): Facebook
 * blue with the white "f" and title.
 */
@Component({
  selector: 'mh-social-sign-in',
  imports: [IonButton, IonSpinner, TranslatePipe],
  templateUrl: './social-sign-in.html',
  styleUrl: './social-sign-in.scss',
})
export class SocialSignIn {
  private readonly _googleSignInService = inject(GoogleSignInService);
  private readonly _appleSignInService = inject(AppleSignInService);
  private readonly _facebookSignInService = inject(FacebookSignInService);

  /** The page is already signing in. */
  readonly disabled = input(false);

  /** The ID token of a completed Google sign-in. */
  readonly googleCredential = output<string>();
  /** Google's sign-in ended without a token, other than by the person closing it. */
  readonly googleFailed = output<void>();
  /** A completed Sign in with Apple, for `AuthService.appleLogin()`. */
  readonly appleCredential = output<AppleLoginRequest>();
  /** Apple's sign in ended without a token, other than by the person closing it. */
  readonly appleFailed = output<void>();
  /** A completed Facebook sign in, for `AuthService.facebookLogin()`. */
  readonly facebookCredential = output<FacebookLoginRequest>();
  /** Facebook's sign in ended without a token, other than by the person closing it. */
  readonly facebookFailed = output<void>();

  protected readonly googleAvailable = this._googleSignInService.available;
  protected readonly appleAvailable = this._appleSignInService.available;
  protected readonly facebookAvailable = this._facebookSignInService.available;
  /** At least one provider works here, so the divider shows. */
  protected readonly anyAvailable = [
    this.googleAvailable,
    this.appleAvailable,
    this.facebookAvailable,
  ].includes(true);

  /** Google's account picker is open. */
  protected readonly googlePending = signal(false);
  /** Apple's sheet is open. */
  protected readonly applePending = signal(false);
  /** Facebook's sheet is open. */
  protected readonly facebookPending = signal(false);

  /** Every button waits while the page signs in or any provider's sheet is open. */
  protected readonly locked = computed(() => {
    if (this.disabled()) {
      return true;
    }
    return [this.googlePending(), this.applePending(), this.facebookPending()].includes(true);
  });

  protected async signInWithGoogle(): Promise<void> {
    if (this.locked()) {
      return;
    }
    this.googlePending.set(true);
    try {
      this.googleCredential.emit(await this._googleSignInService.signIn());
    } catch (error) {
      if (!(error instanceof GoogleSignInCancelled)) {
        this.googleFailed.emit();
      }
    } finally {
      this.googlePending.set(false);
    }
  }

  protected async signInWithApple(): Promise<void> {
    if (this.locked()) {
      return;
    }
    this.applePending.set(true);
    try {
      this.appleCredential.emit(await this._appleSignInService.signIn());
    } catch (error) {
      if (!(error instanceof AppleSignInCancelled)) {
        this.appleFailed.emit();
      }
    } finally {
      this.applePending.set(false);
    }
  }

  protected async signInWithFacebook(): Promise<void> {
    if (this.locked()) {
      return;
    }
    this.facebookPending.set(true);
    try {
      this.facebookCredential.emit(await this._facebookSignInService.signIn());
    } catch (error) {
      if (!(error instanceof FacebookSignInCancelled)) {
        this.facebookFailed.emit();
      }
    } finally {
      this.facebookPending.set(false);
    }
  }
}
