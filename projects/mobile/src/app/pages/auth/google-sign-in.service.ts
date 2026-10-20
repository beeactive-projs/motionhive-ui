import { Service } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SocialLogin, type SocialLoginError } from '@capgo/capacitor-social-login';

import { environment } from 'core';

/** The person closed Google's account picker; not a failure to report. */
export class GoogleSignInCancelled extends Error {}

/**
 * Google sign-in for the app. Core's `GoogleAuthService` draws Google's web
 * button, which Google refuses inside a WebView, so this goes through the
 * native account picker (Credential Manager on Android, Google's SDK on iOS)
 * and hands back the same ID token for `AuthService.googleLogin()`.
 *
 * Android asks for a token for the web client ID, the one the API checks.
 * iOS needs its own client (`googleIosClientId`); without one there is no
 * button there. In the browser the plugin opens Google in a popup that comes
 * back to /auth/login, which must be an authorised redirect URI of the web
 * client.
 */
@Service()
export class GoogleSignInService {
  private _ready: Promise<void> | null = null;

  /** Whether this platform can sign in with Google at all. */
  readonly available = Capacitor.getPlatform() !== 'ios' || !!environment.googleIosClientId;

  /**
   * Opens Google's account picker and resolves the chosen account's ID token.
   * Rejects with `GoogleSignInCancelled` when the picker is dismissed.
   */
  async signIn(): Promise<string> {
    await this.initialize();
    try {
      const { result } = await SocialLogin.login({ provider: 'google', options: {} });
      if (result.responseType === 'online' && result.idToken) return result.idToken;
      throw new Error('No ID token received from Google');
    } catch (error) {
      if ((error as SocialLoginError).code === 'USER_CANCELLED') {
        throw new GoogleSignInCancelled();
      }
      throw error;
    }
  }

  /** Once per app run. A failed setup is forgotten so the next tap retries. */
  private initialize(): Promise<void> {
    this._ready ??= SocialLogin.initialize({
      google: {
        webClientId: environment.googleClientId,
        iOSClientId: environment.googleIosClientId || undefined,
        iOSServerClientId: environment.googleClientId,
        mode: 'online',
        redirectUrl: Capacitor.isNativePlatform()
          ? undefined
          : `${window.location.origin}/auth/login`,
      },
    }).catch((error: unknown) => {
      this._ready = null;
      throw error;
    });
    return this._ready;
  }
}
