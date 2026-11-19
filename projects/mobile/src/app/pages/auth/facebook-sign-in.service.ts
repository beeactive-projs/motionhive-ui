import { InjectionToken, Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  SocialLogin,
  type FacebookLoginResponse,
  type SocialLoginError,
  type SocialLoginPlugin,
} from '@capgo/capacitor-social-login';

import { FacebookLoginRequest, environment, randomHex } from 'core';

/** The person closed Facebook's sheet; not a failure to report. */
export class FacebookSignInCancelled extends Error {}

/** The parts of the social login plugin that Facebook's sign in uses. */
export type FacebookSocialLogin = Pick<SocialLoginPlugin, 'initialize' | 'login' | 'getAuthorizationCode'>;

/** The social login plugin, as a token so specs can hand in a stand-in. */
export const FACEBOOK_SOCIAL_LOGIN = new InjectionToken<FacebookSocialLogin>('FacebookSocialLogin', {
  providedIn: 'root',
  factory: () => SocialLogin,
});

/** The platform the app runs on (`ios`, `android`, `web`), as a token for the same reason. */
export const FACEBOOK_SIGN_IN_PLATFORM = new InjectionToken<string>('FacebookSignInPlatform', {
  providedIn: 'root',
  factory: () => Capacitor.getPlatform(),
});

/**
 * The Meta app's client token. Meta has apps embed it (it is not the App
 * Secret). The same value sits in `ios/App/App/Info.plist`
 * (`FacebookClientToken`) and `android/app/src/main/res/values/strings.xml`
 * (`facebook_client_token`); Android's SDK takes it from here as well.
 */
const FACEBOOK_CLIENT_TOKEN = '46d4a897078e2a1ef8a421a78f97b449';

/** What Facebook is asked to share, the same as on web. */
const FACEBOOK_PERMISSIONS = ['email', 'public_profile'];

/** Where the native Facebook SDK is in the app. */
const FACEBOOK_PLATFORMS: readonly string[] = ['ios', 'android'];

/**
 * Continue with Facebook in the app, through the social login plugin and
 * Facebook's native SDK. Hands back the request for
 * `AuthService.facebookLogin()`.
 *
 * iPhone: Limited Login, so the app never asks for tracking (App Tracking
 * Transparency). Facebook answers with an OpenID Connect ID token instead of
 * a Graph access token, carrying the nonce the app made for this sign in. The
 * API gets the token and the nonce as is (Facebook does not hash it).
 *
 * Android: classic Facebook Login, whose Graph access token goes to the API.
 *
 * The app in a browser has no button: core's popup needs a return page the
 * app does not have.
 */
@Service()
export class FacebookSignInService {
  private readonly _plugin = inject(FACEBOOK_SOCIAL_LOGIN);
  private readonly _platform = inject(FACEBOOK_SIGN_IN_PLATFORM);

  private _ready: Promise<void> | null = null;

  /** Whether this platform can sign in with Facebook at all. */
  readonly available = FACEBOOK_PLATFORMS.includes(this._platform);

  /**
   * Opens Facebook's sheet and resolves the request for the API. Rejects
   * with `FacebookSignInCancelled` when the sheet is dismissed.
   */
  async signIn(): Promise<FacebookLoginRequest> {
    await this.initialize();
    try {
      if (this._platform === 'ios') {
        return await this.signInLimited();
      }
      return await this.signInClassic();
    } catch (error) {
      if ((error as SocialLoginError).code === 'USER_CANCELLED') {
        throw new FacebookSignInCancelled();
      }
      throw error;
    }
  }

  /**
   * iPhone. Without a nonce of its own the plugin sends Facebook "123", so
   * every sign in makes one: 32 random bytes as hex (64 characters, no
   * spaces, inside the API's 32 to 128).
   */
  private async signInLimited(): Promise<FacebookLoginRequest> {
    const rawNonce = randomHex();
    const { result } = await this._plugin.login({
      provider: 'facebook',
      options: { permissions: FACEBOOK_PERMISSIONS, limitedLogin: true, nonce: rawNonce },
    });
    // The plugin sends a missing token as an empty string. There is no
    // falling back to an access token: the API takes the ID token here.
    if (!result.idToken) {
      throw new Error('No ID token received from Facebook');
    }
    return { idToken: result.idToken, rawNonce };
  }

  /**
   * Android. No nonce: the plugin would hand it to the SDK as a log id, not
   * as a nonce, and the API takes no nonce with an access token.
   */
  private async signInClassic(): Promise<FacebookLoginRequest> {
    const { result } = await this._plugin.login({
      provider: 'facebook',
      options: { permissions: FACEBOOK_PERMISSIONS },
    });
    const accessToken = await this.accessTokenOf(result);
    return { accessToken };
  }

  /**
   * The Graph access token of an Android sign in. Facebook's Android SDK
   * always asks for an ID token beside it, and when one comes back the
   * plugin (8.7.4, `FacebookProvider.java`) reports the sign in as Limited
   * Login and leaves the access token out. The SDK still keeps that token as
   * its current one, which the plugin hands out on request.
   */
  private async accessTokenOf(result: FacebookLoginResponse): Promise<string> {
    const fromLogin = result.accessToken;
    if (fromLogin && fromLogin.token) {
      return fromLogin.token;
    }
    const current = await this._plugin.getAuthorizationCode({ provider: 'facebook' });
    if (!current.accessToken) {
      throw new Error('No access token received from Facebook');
    }
    return current.accessToken;
  }

  /**
   * Once per app run. A failed setup is forgotten so the next tap retries.
   * It sets up Facebook alone, so Google's and Apple's setups are left as
   * they are (the plugin keeps each provider apart).
   */
  private initialize(): Promise<void> {
    this._ready ??= this._plugin
      .initialize({
        facebook: { appId: environment.facebookAppId, clientToken: FACEBOOK_CLIENT_TOKEN },
      })
      .catch((error: unknown) => {
        this._ready = null;
        throw error;
      });
    return this._ready;
  }
}
