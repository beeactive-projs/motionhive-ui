import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';

@Component({
  selector: 'mh-facebook-callback',
  template: '<p>Signing in with Facebook...</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacebookCallbackComponent implements OnInit {
  ngOnInit(): void {
    // Use decodeURIComponent instead of URLSearchParams to avoid
    // '+' being decoded as a space (application/x-www-form-urlencoded),
    // which corrupts Facebook access tokens.
    const fragment = this.parseFragment(window.location.hash.substring(1));
    const accessToken = fragment.get('access_token');
    const state = fragment.get('state');
    const error = fragment.get('error');
    const errorDescription = fragment.get('error_description');

    if (window.opener) {
      if (accessToken && state) {
        window.opener.postMessage(
          { type: 'facebook-oauth-callback', accessToken, state },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          {
            type: 'facebook-oauth-callback',
            error: error || 'no_token',
            errorDescription: errorDescription || 'No access token received',
            state,
          },
          window.location.origin,
        );
      }
    }

    window.close();
  }

  private parseFragment(hash: string): Map<string, string> {
    const params = new Map<string, string>();
    if (!hash) return params;

    for (const pair of hash.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;
      const key = decodeURIComponent(pair.substring(0, eqIndex));
      const value = decodeURIComponent(pair.substring(eqIndex + 1));
      params.set(key, value);
    }

    return params;
  }
}
