import { Component, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { AppleAuthService, AppleLoginRequest, GoogleAuthService } from 'core';

/**
 * The "or" divider, then "Continue with Apple" and Google's button, under
 * the sign in and sign up forms.
 *
 * Google draws its own sign-in button (an iframe) and it is shown as drawn.
 * Laying it invisibly over a button of ours made taps do nothing in iOS
 * Safari, and Google's branding rules forbid hiding it anyway.
 * When Google's script is blocked or offline, a disabled stand-in shows.
 *
 * Apple's button is ours, drawn to Apple's rules for a custom button: the
 * Apple logo and "Continue with Apple" in one colour, black on the light
 * page and white on the dark one, and never smaller than Google's. Apple
 * opens a popup, so the click goes straight to `AppleAuthService.signIn()`
 * (see there). There is no Apple button where Apple can't answer: off the
 * web app's own https origin (localhost, preview deploys) or without a
 * Services ID.
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
  private readonly _appleAuthService = inject(AppleAuthService);
  private readonly _googleButton = viewChild.required<ElementRef<HTMLElement>>('googleButton');

  /** The page is already signing in. */
  readonly disabled = input(false);

  /** The ID token of a completed Google sign-in. */
  readonly googleCredential = output<string>();
  /** Google's script failed to load, or its sign-in ended without a token. */
  readonly googleFailed = output<void>();
  /** A completed Sign in with Apple, for `AuthService.appleLogin()`. */
  readonly appleCredential = output<AppleLoginRequest>();
  /** Apple's sign in ended without a token, other than by the person closing it. */
  readonly appleFailed = output<void>();

  /** Google's script is blocked or offline, so there is no button to click. */
  protected readonly googleUnavailable = signal(false);
  protected readonly appleAvailable = this._appleAuthService.available;
  /** Apple's popup is open. */
  protected readonly applePending = signal(false);

  constructor() {
    afterNextRender(async () => {
      // Apple's script loads now, so the click can open its popup at once.
      if (this.appleAvailable) {
        void this._appleAuthService.prepare();
      }
      const rendered = await this._googleAuthService.renderButton(
        this._googleButton().nativeElement,
        (idToken) => this.googleCredential.emit(idToken),
        () => this.googleFailed.emit(),
      );
      this.googleUnavailable.set(!rendered);
    });
  }

  protected async signInWithApple(): Promise<void> {
    if (this.applePending()) {
      return;
    }
    this.applePending.set(true);
    try {
      // First thing in the click: the popup must open while it is handled.
      const result = await this._appleAuthService.signIn();
      if (result.status === 'signed-in') {
        this.appleCredential.emit(result.request);
      }
    } catch {
      this.appleFailed.emit();
    } finally {
      this.applePending.set(false);
    }
  }
}
