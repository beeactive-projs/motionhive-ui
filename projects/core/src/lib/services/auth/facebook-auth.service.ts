import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/** What the web app's `/auth/facebook-callback` page posts back to the page that opened it. */
export interface FacebookOAuthMessage {
  type: 'facebook-oauth-callback';
  accessToken?: string;
  error?: string;
  errorReason?: string;
  errorDescription?: string;
  state?: string | null;
}

/** A finished Facebook popup: the token for `AuthService.facebookLogin()`, or the person backed out. */
export type FacebookWebSignInResult =
  | { status: 'signed-in'; accessToken: string }
  | { status: 'cancelled' };

/** Facebook's answer when the person pressed Cancel on its dialog. */
const FACEBOOK_CANCEL_ERROR = 'access_denied';

function isFacebookOAuthMessage(data: unknown): data is FacebookOAuthMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>)['type'] === 'facebook-oauth-callback'
  );
}

/**
 * Facebook Login on the web: Facebook's own dialog in a popup, which comes
 * back to `/auth/facebook-callback` on this origin. That page posts the
 * access token (or Facebook's error) to this window, and `POST
 * /auth/facebook` checks the token with Facebook.
 *
 * The redirect address must be listed under the Meta app's Valid OAuth
 * Redirect URIs (strict mode), one per web origin. Facebook's dialog sends
 * `Cross-Origin-Opener-Policy: unsafe-none`, so the popup keeps its link to
 * this window (checked in Safari and Chrome, 2026-11-19).
 */
@Injectable({
  providedIn: 'root',
})
export class FacebookAuthService {
  private readonly _ngZone = inject(NgZone);

  private static readonly POPUP_WIDTH = 600;
  private static readonly POPUP_HEIGHT = 700;
  private static readonly TIMEOUT_MS = 120_000;
  private static readonly POLL_INTERVAL_MS = 500;
  private static readonly CLOSE_GRACE_MS = 1_000;
  private static readonly FB_OAUTH_VERSION = 'v21.0';

  /**
   * Opens Facebook's dialog and resolves with the access token, or
   * `cancelled` when the person closed the popup or pressed Cancel. Rejects
   * when the popup was blocked, timed out, or Facebook answered with an error
   * or another sign in's state. Call it first thing in the click handler:
   * the popup has to open while the click is being handled.
   */
  signIn(): Promise<FacebookWebSignInResult> {
    return new Promise<FacebookWebSignInResult>((resolve, reject) => {
      const state = this.generateNonce();
      const redirectUri = `${window.location.origin}/auth/facebook-callback`;
      const oauthUrl = this.buildOAuthUrl(redirectUri, state);

      const popup = this.openPopup(oauthUrl);
      if (!popup) {
        reject(new Error('Popup was blocked. Please allow popups for this site.'));
        return;
      }

      let cleaned = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let pollId: ReturnType<typeof setInterval> | undefined;

      const cleanup = (): void => {
        if (cleaned) {
          return;
        }
        cleaned = true;
        window.removeEventListener('message', onMessage);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (pollId) {
          clearInterval(pollId);
        }
      };

      const onMessage = (event: MessageEvent): void => {
        if (event.origin !== window.location.origin) {
          return;
        }
        if (!isFacebookOAuthMessage(event.data)) {
          return;
        }

        const data = event.data;
        cleanup();

        this._ngZone.run(() => {
          if (data.state !== state) {
            reject(new Error('OAuth state mismatch'));
          } else if (data.accessToken) {
            resolve({ status: 'signed-in', accessToken: data.accessToken });
          } else if (data.error === FACEBOOK_CANCEL_ERROR) {
            resolve({ status: 'cancelled' });
          } else {
            reject(new Error(data.errorDescription || 'Facebook login failed'));
          }
        });
      };

      window.addEventListener('message', onMessage);

      // Closed with no answer: the person closed the popup. The callback page
      // closes itself right after posting, so its message gets a moment to
      // arrive before the close counts as a cancel.
      pollId = setInterval(() => {
        if (!popup.closed) {
          return;
        }
        clearInterval(pollId);
        pollId = undefined;
        setTimeout(() => {
          if (cleaned) {
            return;
          }
          cleanup();
          this._ngZone.run(() => resolve({ status: 'cancelled' }));
        }, FacebookAuthService.CLOSE_GRACE_MS);
      }, FacebookAuthService.POLL_INTERVAL_MS);

      timeoutId = setTimeout(() => {
        cleanup();
        if (!popup.closed) {
          popup.close();
        }
        this._ngZone.run(() => reject(new Error('Facebook login timed out')));
      }, FacebookAuthService.TIMEOUT_MS);
    });
  }

  private buildOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: environment.facebookAppId,
      redirect_uri: redirectUri,
      scope: 'email,public_profile',
      response_type: 'token',
      state,
    });
    return `https://www.facebook.com/${FacebookAuthService.FB_OAUTH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  private openPopup(url: string): Window | null {
    const left = Math.round((window.screen.width - FacebookAuthService.POPUP_WIDTH) / 2);
    const top = Math.round((window.screen.height - FacebookAuthService.POPUP_HEIGHT) / 2);
    const features = [
      `width=${FacebookAuthService.POPUP_WIDTH}`,
      `height=${FacebookAuthService.POPUP_HEIGHT}`,
      `left=${left}`,
      `top=${top}`,
      'menubar=no',
      'toolbar=no',
      'location=yes',
      'status=no',
      'scrollbars=yes',
      'resizable=yes',
    ].join(',');

    return window.open(url, 'facebook-oauth', features);
  }

  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
