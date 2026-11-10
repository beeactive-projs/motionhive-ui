import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { User } from '../../models/user/user.model';
import { AuthStore } from '../../stores/auth.store';
import { LanguageService } from '../i18n/language.service';
import { AppleAuthService } from './apple-auth.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const LOGOUT_URL = `${environment.apiUrl}${API_ENDPOINTS.AUTH.LOGOUT}`;
const APPLE_URL = `${environment.apiUrl}${API_ENDPOINTS.AUTH.APPLE}`;
const ME_URL = `${environment.apiUrl}${API_ENDPOINTS.USERS.ME}`;

describe('AuthService.logout', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenService: TokenService;
  let authStore: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: Router, useValue: {} },
        { provide: LanguageService, useValue: {} },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    authStore = TestBed.inject(AuthStore);

    tokenService.setAccessToken('access');
    tokenService.setRefreshToken('refresh');
    authStore.setUser({ id: 'u1' } as User);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  const signedIn = () => authStore.isAuthenticated() || tokenService.getAccessToken() !== null;

  it('revokes the refresh token and ends the session before the caller hears back', () => {
    let signedInOnNext: boolean | undefined;
    service.logout().subscribe(() => (signedInOnNext = signedIn()));

    const req = httpMock.expectOne(LOGOUT_URL);
    expect(req.request.body).toEqual({ refreshToken: 'refresh' });
    req.flush(null);

    expect(signedInOnNext).toBe(false);
    expect(signedIn()).toBe(false);
  });

  it('still ends the session when the request fails', () => {
    let signedInOnError: boolean | undefined;
    service.logout().subscribe({ error: () => (signedInOnError = signedIn()) });

    httpMock.expectOne(LOGOUT_URL).error(new ProgressEvent('offline'));

    expect(signedInOnError).toBe(false);
    expect(signedIn()).toBe(false);
  });
});

describe('AuthService.appleLogin', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let forgetSharedName: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    forgetSharedName = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: Router, useValue: {} },
        { provide: LanguageService, useValue: { syncFromUser: () => undefined } },
        { provide: AppleAuthService, useValue: { forgetSharedName } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.ngOnDestroy();
    localStorage.clear();
  });

  const request = {
    identityToken: 'apple.identity.token',
    rawNonce: 'a'.repeat(64),
    authorizationCode: 'one-time-code',
    firstName: 'Ana',
    lastName: 'Pop',
  };

  it('posts the Apple sign in with the app language, then signs in like Google', () => {
    let user: User | undefined;
    service.appleLogin(request).subscribe((signedIn) => (user = signedIn));

    const post = httpMock.expectOne(APPLE_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ ...request, language: expect.any(String) });
    post.flush({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'u1' } });

    expect(forgetSharedName).toHaveBeenCalledTimes(1);
    httpMock.expectOne(ME_URL).flush({ id: 'u1', firstName: 'Ana' });
    expect(user).toEqual({ id: 'u1', firstName: 'Ana' });
  });

  it('keeps the name Apple shared when the API did not take it', () => {
    service.appleLogin(request).subscribe({ error: () => undefined });

    httpMock.expectOne(APPLE_URL).flush({ message: 'down' }, { status: 503, statusText: 'Unavailable' });

    expect(forgetSharedName).not.toHaveBeenCalled();
  });
});
