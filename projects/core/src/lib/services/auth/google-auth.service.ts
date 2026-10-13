import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { appLanguage } from '../../i18n/app-language';

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

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

function getGoogleAccountsId(): GoogleAccountsId | undefined {
  const w = window as unknown as Record<string, Record<string, Record<string, unknown>>>;
  return w['google']?.['accounts']?.['id'] as GoogleAccountsId | undefined;
}

/** The in-flight or finished script load, shared by every button on the page. */
let gsiLoad: Promise<GoogleAccountsId> | null = null;

/**
 * Loads the GIS script on first use. Loading it here rather than from
 * index.html means its outcome is never missed: a blocked script rejects
 * this promise instead of firing an `error` event nobody was listening for
 * yet. A failed load is forgotten, so the next sign-in page tries again.
 */
function loadGoogleAccountsId(): Promise<GoogleAccountsId> {
  const ready = getGoogleAccountsId();
  if (ready) return Promise.resolve(ready);

  gsiLoad ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    // Without `hl` the placeholder Google draws before its iframe loads
    // follows the visitor's location, not the page.
    script.src = `${GSI_SCRIPT_URL}?hl=${appLanguage()}`;
    script.async = true;
    script.onload = () => {
      const gsi = getGoogleAccountsId();
      if (gsi) resolve(gsi);
      else reject(new Error('Google Identity Services did not initialize'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Google Identity Services failed to load'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    gsiLoad = null;
    throw error;
  });
  return gsiLoad;
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
   *
   * Resolves `true` once the button is drawn, or `false` when Google is
   * unavailable (blocked or offline; `onError` is called too) or the
   * container left the page while the script was loading.
   */
  async renderButton(
    container: HTMLElement,
    onCredential: (idToken: string) => void,
    onError?: (error: Error) => void,
  ): Promise<boolean> {
    let gsi: GoogleAccountsId;
    try {
      gsi = await loadGoogleAccountsId();
    } catch (error) {
      if (container.isConnected) onError?.(error as Error);
      return false;
    }
    // The user may have navigated away while the script was loading.
    if (!container.isConnected) return false;

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
      // Also in dark mode: Google's dark themes put the logo on a white tile.
      theme: 'outline',
      size: 'large',
      // Shown on both sign in and sign up.
      text: 'continue_with',
      shape: 'rectangular',
      // Logo beside the label, like our icon buttons, not pinned to the edge.
      logo_alignment: 'center',
      width: container.offsetWidth,
      // Google otherwise picks its own language (browser/geo), which can
      // disagree with the page around the button.
      locale: appLanguage(),
    });
    return true;
  }
}
