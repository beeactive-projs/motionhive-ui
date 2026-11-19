import { Component, inject, input, output, signal } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AppleLoginRequest } from 'core';

import { AppleSignInCancelled, AppleSignInService } from '../../apple-sign-in.service';
import { GoogleSignInCancelled, GoogleSignInService } from '../../google-sign-in.service';

/**
 * The "or" divider, "Continue with Apple" and "Continue with Google" under
 * the sign in and sign up forms, as on web. Web shows Google's own drawn
 * button; the app opens the native account picker, so the button is ours,
 * drawn to Google's branding (the four colour mark, a neutral outlined
 * button). Closing either sheet is not an error.
 *
 * Apple comes first, on iPhone only (see `AppleSignInService`), drawn to
 * Apple's rules for a custom button: the logo and title in one colour, black
 * on the light theme and white on the dark one, and the same size as
 * Google's. Each provider shows only where it works; with neither, nothing
 * shows.
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

  protected readonly googleAvailable = this._googleSignInService.available;
  protected readonly appleAvailable = this._appleSignInService.available;
  /** Google's account picker is open. */
  protected readonly googlePending = signal(false);
  /** Apple's sheet is open. */
  protected readonly applePending = signal(false);

  protected async signInWithGoogle(): Promise<void> {
    if (this.googlePending()) {
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
    if (this.applePending()) {
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
}
