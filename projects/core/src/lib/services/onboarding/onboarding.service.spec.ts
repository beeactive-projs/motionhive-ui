import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { Genders } from '../../models/profile/profile.enums';
import type { OnboardingState } from '../../models/onboarding/onboarding.model';
import { OnboardingService } from './onboarding.service';

const BASE = `${environment.apiUrl}${API_ENDPOINTS.ONBOARDING.BASE}`;

describe('OnboardingService, about you', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('puts the birthday and gender to /about and hands back the new state', () => {
    let answer: OnboardingState | null = null;
    TestBed.inject(OnboardingService)
      .setAboutYou({ birthDate: '1992-03-14', gender: Genders.Female })
      .subscribe((state) => {
        answer = state;
      });

    const request = httpMock.expectOne(`${BASE}/about`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ birthDate: '1992-03-14', gender: 'FEMALE' });
    const state = { flow: [] } as unknown as OnboardingState;
    request.flush(state);
    expect(answer).toBe(state);
  });

  it('sends only what was answered', () => {
    TestBed.inject(OnboardingService).setAboutYou({ gender: Genders.PreferNotToSay }).subscribe();

    const request = httpMock.expectOne(`${BASE}/about`);
    expect(request.request.body).toEqual({ gender: 'PREFER_NOT_TO_SAY' });
    request.flush({});
  });
});
