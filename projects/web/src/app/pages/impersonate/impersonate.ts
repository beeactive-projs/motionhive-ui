import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  API_ENDPOINTS,
  TokenService,
  User,
  environment,
} from 'core';

/**
 * Impersonation handoff target. The admin console mints a short-lived
 * access token and opens this route (`/impersonate?token=...`) in a new
 * tab. We seed the token, hydrate the impersonated user from /users/me,
 * then hard-reload into the app as that user.
 *
 * Additive + guarded by construction: it does NOTHING unless a token is
 * present in the query string, so it can never affect normal sessions.
 * The token carries no refresh token, so the session self-expires (~30m).
 */
@Component({
  selector: 'mh-impersonate',
  imports: [],
  template: `
    <div class="flex min-h-screen items-center justify-center">
      <p class="text-sm opacity-70">{{ message() }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Impersonate {
  private readonly _route = inject(ActivatedRoute);
  private readonly _http = inject(HttpClient);
  private readonly _tokens = inject(TokenService);

  readonly message = signal('Starting impersonation session…');

  constructor() {
    const token = this._route.snapshot.queryParamMap.get('token');
    // Scrub the token from the URL/history immediately so it can't linger
    // in the address bar, browser history, or a Referer header.
    try {
      history.replaceState(null, '', '/impersonate');
    } catch {
      /* non-fatal */
    }
    if (!token) {
      this.message.set('Missing impersonation token.');
      return;
    }

    // Replace any existing session in this origin with the impersonation
    // token, then load the target user so checkAuthStatus() rehydrates
    // on reload (it requires both token AND user in storage).
    this._tokens.clearTokens();
    this._tokens.setAccessToken(token);

    // Mark this browser context as an impersonation session so the app
    // shell can show a persistent banner + "exit" control. Best-effort.
    try {
      const claims = JSON.parse(atob(token.split('.')[1] ?? '')) as {
        act_as?: string;
        email?: string;
      };
      localStorage.setItem(
        'mh_impersonation',
        JSON.stringify({ by: claims.act_as ?? null, at: Date.now() }),
      );
    } catch {
      /* non-fatal — banner just won't show */
    }

    this._http.get<User>(`${environment.apiUrl}${API_ENDPOINTS.USERS.ME}`).subscribe({
      next: (user) => {
        this._tokens.setUser(user);
        this._tokens.setRoles(user.roles ?? []);
        window.location.assign('/');
      },
      error: () => {
        this._tokens.clearTokens();
        localStorage.removeItem('mh_impersonation');
        this.message.set('Impersonation failed or the token has expired.');
      },
    });
  }
}
