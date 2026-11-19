import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { APP_HOME_URL, AuthService, ClientInviteService, FacebookLoginRequest } from 'core';

import { InviteLandingService } from '../invite-landing.service';
import { Login } from './login';

const HOME = '/tabs/home';

function setup(reply: () => Observable<unknown>) {
  const authService = { facebookLogin: vi.fn(reply) };
  const navController = { navigateRoot: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: NavController, useValue: navController },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParams: {}, queryParamMap: convertToParamMap({}) } },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: APP_HOME_URL, useValue: HOME },
      {
        provide: ClientInviteService,
        useValue: { token: null, details: signal(null), invalid: signal(false), coachName: signal(''), load: vi.fn() },
      },
      { provide: InviteLandingService, useValue: { open: vi.fn() } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new Login());
  return { page, authService, navController };
}

describe('Login, Continue with Facebook', () => {
  const request: FacebookLoginRequest = { idToken: 'facebook.id.token', rawNonce: 'b'.repeat(64) };

  it('signs in with the request as the buttons hand it over, then goes into the app', () => {
    const { page, authService, navController } = setup(() => of({ id: 'u1' }));

    page['onFacebookCredential'](request);

    expect(authService.facebookLogin).toHaveBeenCalledWith(request);
    expect(navController.navigateRoot).toHaveBeenCalledWith(HOME);
    expect(page['isLoading']()).toBe(false);
  });

  it("shows the API's message when it refused, or Facebook's own failure line", () => {
    const refused = setup(() => throwError(() => ({ status: 400, error: { message: 'Facebook said no.' } })));
    refused.page['onFacebookCredential'](request);
    expect(refused.page['errorMessage']()).toBe('Facebook said no.');

    TestBed.resetTestingModule();
    const silent = setup(() => throwError(() => ({ error: {} })));
    silent.page['onFacebookCredential'](request);
    expect(silent.page['errorMessage']()).toBe('auth.common.facebookFailed');
  });

  it("shows Facebook's failure line when the sheet failed", () => {
    const { page, authService } = setup(() => of({}));

    page['onFacebookFailed']();

    expect(page['errorMessage']()).toBe('auth.common.facebookFailed');
    expect(authService.facebookLogin).not.toHaveBeenCalled();
  });
});
