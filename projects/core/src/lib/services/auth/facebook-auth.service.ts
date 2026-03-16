import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

interface FacebookOAuthMessage {
  type: 'facebook-oauth-callback';
  accessToken?: string;
  error?: string;
  errorDescription?: string;
  state?: string;
}

function isFacebookOAuthMessage(data: unknown): data is FacebookOAuthMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>)['type'] === 'facebook-oauth-callback'
  );
}

@Injectable({
  providedIn: 'root',
})
export class FacebookAuthService {
  private readonly _ngZone = inject(NgZone);

  private static readonly POPUP_WIDTH = 600;
  private static readonly POPUP_HEIGHT = 700;
  private static readonly TIMEOUT_MS = 120_000;
  private static readonly POLL_INTERVAL_MS = 500;
  private static readonly FB_OAUTH_VERSION = 'v21.0';

  signIn(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
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
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener('message', onMessage);
        if (timeoutId) clearTimeout(timeoutId);
        if (pollId) clearInterval(pollId);
      };

      const onMessage = (event: MessageEvent): void => {
        if (event.origin !== window.location.origin) return;
        if (!isFacebookOAuthMessage(event.data)) return;

        const data = event.data;

        if (data.state !== state) {
          cleanup();
          this._ngZone.run(() => reject(new Error('OAuth state mismatch')));
          return;
        }

        cleanup();

        this._ngZone.run(() => {
          if (data.accessToken) {
            resolve(data.accessToken);
          } else {
            reject(new Error(data.errorDescription || 'Facebook login was cancelled or failed'));
          }
        });
      };

      window.addEventListener('message', onMessage);

      pollId = setInterval(() => {
        if (popup.closed) {
          cleanup();
          this._ngZone.run(() => reject(new Error('Facebook login was cancelled or failed')));
        }
      }, FacebookAuthService.POLL_INTERVAL_MS);

      timeoutId = setTimeout(() => {
        cleanup();
        if (!popup.closed) popup.close();
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
