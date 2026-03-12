import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

interface CredentialResponse {
  credential: string;
  select_by: string;
  clientId?: string;
}

interface GsiButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }): void;
  renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
}

function getGoogleAccountsId(): GoogleAccountsId | undefined {
  const w = window as unknown as Record<string, Record<string, Record<string, unknown>>>;
  return w['google']?.['accounts']?.['id'] as GoogleAccountsId | undefined;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  private readonly _ngZone = inject(NgZone);

  /**
   * Initializes Google Identity Services and renders the sign-in button
   * into the given container element.
   *
   * When the user completes sign-in, `onCredential` is called with the
   * ID token (JWT) that can be sent to the backend.
   */
  renderButton(
    container: HTMLElement,
    onCredential: (idToken: string) => void,
    onError?: (error: Error) => void,
  ): void {
    const gsi = getGoogleAccountsId();
    if (!gsi) {
      onError?.(new Error('Google Identity Services not loaded'));
      return;
    }

    gsi.initialize({
      client_id: environment.googleClientId,
      callback: (response: CredentialResponse) => {
        this._ngZone.run(() => {
          if (response.credential) {
            onCredential(response.credential);
          } else {
            onError?.(new Error('No credential received from Google'));
          }
        });
      },
    });

    gsi.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: container.offsetWidth,
    });
  }
}
