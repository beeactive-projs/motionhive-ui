import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { isSilentRequest } from '../interceptors/silent-request.context';
import { ClientPaymentService } from './payment/client-payment.service';
import { EarningsService } from './payment/earnings.service';
import { ProductService } from './payment/product.service';
import { ProfileService } from './profile/profile.service';
import { VenueService } from './venue/venue.service';

/**
 * Reads a screen may take over the failure of: silent only when the caller
 * says it shows its own failure state, so every other caller keeps the
 * global error dialog it relies on.
 */
describe('silent reads', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const cases: [string, string, (silent?: boolean) => void][] = [
    [
      'ProfileService.getMyProfile',
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.BASE}/me`,
      (silent) =>
        TestBed.inject(ProfileService)
          .getMyProfile(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProductService.list',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCTS}`,
      (silent) =>
        TestBed.inject(ProductService)
          .list({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'EarningsService.getSummary',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.EARNINGS}`,
      (silent) =>
        TestBed.inject(EarningsService)
          .getSummary(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ClientPaymentService.getMyCounts',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_COUNTS}`,
      (silent) =>
        TestBed.inject(ClientPaymentService)
          .getMyCounts(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'VenueService.list',
      `${environment.apiUrl}/venues`,
      (silent) =>
        TestBed.inject(VenueService)
          .list(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
  ];

  for (const [name, url, call] of cases) {
    it(`${name} keeps the dialog by default`, () => {
      call();
      const req = httpMock.expectOne(url);
      expect(isSilentRequest(req.request.context)).toBe(false);
      req.flush({});
    });

    it(`${name} skips it when the screen reports the failure itself`, () => {
      call(true);
      const req = httpMock.expectOne(url);
      expect(isSilentRequest(req.request.context)).toBe(true);
      req.flush({});
    });
  }
});
