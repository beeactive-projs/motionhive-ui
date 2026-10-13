import { Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { GoogleAuthService } from 'core';

/**
 * The "or" divider and Google button under the sign in and sign up forms.
 * Google's own label ("Continue with Google") says the rest.
 *
 * Google draws its own sign-in button (an iframe) and it is shown as drawn.
 * Laying it invisibly over a button of ours made taps do nothing in iOS
 * Safari, and Google's branding rules forbid hiding it anyway.
 * When Google's script is blocked or offline, a disabled stand-in shows.
 *
 * Facebook is off until Meta approves the app. To bring it back, add its
 * button here with an output the pages handle with core's
 * `FacebookAuthService.signIn()` then `AuthService.facebookLogin()`.
 */
@Component({
  selector: 'mh-social-sign-in',
  imports: [ButtonDirective, Divider, TranslatePipe],
  templateUrl: './social-sign-in.html',
  styleUrl: './social-sign-in.scss',
})
export class SocialSignIn {
  private readonly _googleAuthService = inject(GoogleAuthService);
  private readonly _googleButton = viewChild.required<ElementRef<HTMLElement>>('googleButton');

  /** The ID token of a completed Google sign-in. */
  readonly googleCredential = output<string>();
  /** Google's script failed to load, or its sign-in ended without a token. */
  readonly googleFailed = output<void>();

  /** Google's script is blocked or offline, so there is no button to click. */
  protected readonly googleUnavailable = signal(false);

  constructor() {
    afterNextRender(async () => {
      const rendered = await this._googleAuthService.renderButton(
        this._googleButton().nativeElement,
        (idToken) => this.googleCredential.emit(idToken),
        () => this.googleFailed.emit(),
      );
      this.googleUnavailable.set(!rendered);
    });
  }
}
