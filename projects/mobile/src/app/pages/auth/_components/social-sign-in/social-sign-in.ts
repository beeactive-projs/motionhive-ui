import { Component, inject, input, output, signal } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GoogleSignInCancelled, GoogleSignInService } from '../../google-sign-in.service';

/**
 * The "or" divider and "Continue with Google" under the sign in and sign up
 * forms, as on web. Web shows Google's own drawn button; the app opens the
 * native account picker, so the button is ours, drawn to Google's branding
 * (the four colour mark, a neutral outlined button). Closing the picker is
 * not an error. Not shown on a platform without a Google client.
 */
@Component({
  selector: 'mh-social-sign-in',
  imports: [IonButton, IonSpinner, TranslatePipe],
  templateUrl: './social-sign-in.html',
  styleUrl: './social-sign-in.scss',
})
export class SocialSignIn {
  private readonly _googleSignInService = inject(GoogleSignInService);

  /** The page is already signing in. */
  readonly disabled = input(false);

  /** The ID token of a completed Google sign-in. */
  readonly googleCredential = output<string>();
  /** Google's sign-in ended without a token, other than by the person closing it. */
  readonly googleFailed = output<void>();

  protected readonly available = this._googleSignInService.available;
  /** Google's account picker is open. */
  protected readonly pending = signal(false);

  protected async signInWithGoogle(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      this.googleCredential.emit(await this._googleSignInService.signIn());
    } catch (error) {
      if (!(error instanceof GoogleSignInCancelled)) this.googleFailed.emit();
    } finally {
      this.pending.set(false);
    }
  }
}
