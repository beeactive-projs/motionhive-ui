import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { APP_HOME_URL, AuthService, AuthStore, ClientInviteService, FacebookLoginRequest } from 'core';

import { InviteLandingService } from '../invite-landing.service';
import { SignUp } from './sign-up';

const HOME = '/tabs/home';

function setup(reply: () => Observable<unknown>) {
  const authService = { facebookLogin: vi.fn(reply) };
  const navController = { navigateRoot: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: AuthStore, useValue: { isAuthenticated: () => false } },
      { provide: NavController, useValue: navController },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParams: {}, queryParamMap: convertToParamMap({}) } },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: APP_HOME_URL, useValue: HOME },
      {
        provide: ClientInviteService,
        useValue: { token: null, details: signal(null), coachName: signal(''), load: vi.fn() },
      },
      { provide: InviteLandingService, useValue: { open: vi.fn() } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new SignUp());
  return { page, authService, navController };
}

describe('SignUp, Continue with Facebook', () => {
  const request: FacebookLoginRequest = { accessToken: 'graph-token' };

  it('signs up with the request as the buttons hand it over, then goes into the app', () => {
    const { page, authService, navController } = setup(() => of({ id: 'u1' }));

    page['onFacebookCredential'](request);

    expect(authService.facebookLogin).toHaveBeenCalledWith(request);
    expect(navController.navigateRoot).toHaveBeenCalledWith(HOME);
    expect(page['isLoading']()).toBe(false);
  });

  it("falls back to Facebook's failure line when the API gave no message", () => {
    const { page } = setup(() => throwError(() => ({ error: {} })));

    page['onFacebookCredential'](request);

    expect(page['errorMessage']()).toBe('auth.common.facebookFailed');
  });

  it("shows Facebook's failure line when the sheet failed", () => {
    const { page, authService } = setup(() => of({}));

    page['onFacebookFailed']();

    expect(page['errorMessage']()).toBe('auth.common.facebookFailed');
    expect(authService.facebookLogin).not.toHaveBeenCalled();
  });
});
