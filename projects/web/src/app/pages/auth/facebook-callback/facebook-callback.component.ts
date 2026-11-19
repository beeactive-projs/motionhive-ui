import { Component, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FacebookOAuthMessage } from 'core';

/**
 * Where Facebook's dialog comes back to inside the popup that
 * `FacebookAuthService.signIn()` opened. It posts Facebook's answer to that
 * window and closes. A signed in answer arrives in the fragment
 * (`#access_token=…&state=…`); a cancel arrives in the query
 * (`?error=access_denied&error_reason=user_denied&state=…#_=_`).
 */
@Component({
  selector: 'mh-facebook-callback',
  imports: [TranslatePipe],
  template: `<p>{{ 'auth.oauthCallback.facebook' | translate }}</p>`,
})
export class FacebookCallbackComponent implements OnInit {
  ngOnInit(): void {
    // Use decodeURIComponent instead of URLSearchParams to avoid
    // '+' being decoded as a space (application/x-www-form-urlencoded),
    // which corrupts Facebook access tokens.
    const fragment = this.parseParams(window.location.hash.substring(1));
    const query = this.parseParams(window.location.search.substring(1));
    const accessToken = fragment.get('access_token');
    const state = this.firstOf(fragment, query, 'state');

    if (window.opener) {
      let message: FacebookOAuthMessage;
      if (accessToken && state) {
        message = { type: 'facebook-oauth-callback', accessToken, state };
      } else {
        message = {
          type: 'facebook-oauth-callback',
          error: this.firstOf(fragment, query, 'error') ?? 'no_token',
          errorReason: this.firstOf(fragment, query, 'error_reason') ?? undefined,
          errorDescription:
            this.firstOf(fragment, query, 'error_description') ?? 'No access token received',
          state,
        };
      }
      window.opener.postMessage(message, window.location.origin);
    }

    window.close();
  }

  /** A value from the fragment, else from the query. */
  private firstOf(fragment: Map<string, string>, query: Map<string, string>, key: string): string | null {
    const fromFragment = fragment.get(key);
    if (fromFragment) {
      return fromFragment;
    }
    return query.get(key) ?? null;
  }

  private parseParams(raw: string): Map<string, string> {
    const params = new Map<string, string>();
    if (!raw) {
      return params;
    }

    for (const pair of raw.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = decodeURIComponent(pair.substring(0, eqIndex));
      const value = decodeURIComponent(pair.substring(eqIndex + 1));
      params.set(key, value);
    }

    return params;
  }
}
