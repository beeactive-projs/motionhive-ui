import { InjectionToken, Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SocialLogin, type SocialLoginError, type SocialLoginPlugin } from '@capgo/capacitor-social-login';

import { AppleLoginRequest, appleSharedName, createAppleNonce } from 'core';

/** The person closed Apple's sheet; not a failure to report. */
export class AppleSignInCancelled extends Error {}

/** The parts of the social login plugin that Apple's sign in uses. */
export type AppleSocialLogin = Pick<SocialLoginPlugin, 'initialize' | 'login' | 'logout'>;

/** The social login plugin, as a token so specs can hand in a stand-in. */
export const APPLE_SOCIAL_LOGIN = new InjectionToken<AppleSocialLogin>('AppleSocialLogin', {
  providedIn: 'root',
  factory: () => SocialLogin,
});

/** The platform the app runs on (`ios`, `android`, `web`), as a token for the same reason. */
export const APPLE_SIGN_IN_PLATFORM = new InjectionToken<string>('AppleSignInPlatform', {
  providedIn: 'root',
  factory: () => Capacitor.getPlatform(),
});

/**
 * Sign in with Apple in the app, on iPhone only: the native Apple sheet
 * (AuthenticationServices), through the social login plugin, signed in with
 * the app's own bundle id. Hands back the request for
 * `AuthService.appleLogin()`.
 *
 * Android has no native Apple sign in, and the plugin's web flow there needs
 * a return address on our API (later). In the browser the app runs on
 * localhost, which Apple refuses. So there is no button on either.
 *
 * Apple shares the name on the first authorization only. The plugin keeps it
 * on the phone and fills it in on later sign ins, so a retry after a failed
 * request still carries it; deleting the account clears it
 * (`clearCachedName`).
 */
@Service()
export class AppleSignInService {
  private readonly _plugin = inject(APPLE_SOCIAL_LOGIN);

  private _ready: Promise<void> | null = null;

  /** Whether this platform can sign in with Apple at all. */
  readonly available = inject(APPLE_SIGN_IN_PLATFORM) === 'ios';

  /**
   * Opens Apple's sheet and resolves the request for the API. Rejects with
   * `AppleSignInCancelled` when the sheet is dismissed.
   */
  async signIn(): Promise<AppleLoginRequest> {
    await this.initialize();
    const nonce = await createAppleNonce();
    try {
      const { result } = await this._plugin.login({
        provider: 'apple',
        // No `scopes`: the plugin's default asks for the full name and the
        // email, Apple's native scope names, which differ from the web's.
        options: { nonce: nonce.hashed },
      });
      if (!result.idToken) {
        throw new Error('No identity token received from Apple');
      }
      const request: AppleLoginRequest = { identityToken: result.idToken, rawNonce: nonce.raw };
      if (result.authorizationCode) {
        request.authorizationCode = result.authorizationCode;
      }
      // The plugin sends an unknown name as an empty string.
      const name = appleSharedName(result.profile.givenName, result.profile.familyName);
      if (name) {
        Object.assign(request, name);
      }
      return request;
    } catch (error) {
      if ((error as SocialLoginError).code === 'USER_CANCELLED') {
        throw new AppleSignInCancelled();
      }
      throw error;
    }
  }

  /**
   * Forgets the name the plugin keeps for Apple, for when the account is
   * deleted. Best effort: it never fails the caller.
   */
  async clearCachedName(): Promise<void> {
    if (!this.available) {
      return;
    }
    try {
      await this._plugin.logout({ provider: 'apple', clearCachedUserInfo: true });
    } catch {
      // The plugin clears the name before it looks for a session, so a
      // "not logged in" answer here still left nothing behind.
    }
  }

  /** Once per app run. A failed setup is forgotten so the next tap retries. */
  private initialize(): Promise<void> {
    this._ready ??= this._plugin
      .initialize({
        apple: {
          // No redirect: the app hands the token to our API itself. An empty
          // string is what keeps the plugin from posting it anywhere.
          redirectUrl: '',
          // Also return Apple's one-time code, which the API trades for the
          // token it revokes Apple with when the account is deleted.
          useProperTokenExchange: true,
        },
      })
      .catch((error: unknown) => {
        this._ready = null;
        throw error;
      });
    return this._ready;
  }
}
