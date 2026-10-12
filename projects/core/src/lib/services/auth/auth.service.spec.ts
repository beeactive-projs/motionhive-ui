import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const LOGOUT_URL = `${environment.apiUrl}${API_ENDPOINTS.AUTH.LOGOUT}`;

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
