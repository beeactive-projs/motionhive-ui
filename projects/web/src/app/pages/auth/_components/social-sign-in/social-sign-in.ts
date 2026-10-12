import { Component, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { GoogleAuthService } from 'core';

/**
 * The "or continue with" block under the sign in and sign up forms.
 *
 * Google draws its own sign-in button (an iframe); it is laid invisibly over
 * ours, so the look is ours and the click is Google's. Ours is hidden from
 * keyboard and screen readers, who reach Google's button directly.
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

  /** Translation key for the divider label. */
  readonly label = input.required<string>();
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
