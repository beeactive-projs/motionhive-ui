import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';

import { APP_HOME_URL } from '../constants/app-urls.const';
import { TokenService } from '../services/auth/token.service';
import { guestGuard } from './guest.guard';

function run(
  params: Record<string, string>,
  { signedIn = true, home }: { signedIn?: boolean; home?: string } = {},
): boolean | string {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TokenService, useValue: { getAccessToken: () => (signedIn ? 'token' : null) } },
      ...(home ? [{ provide: APP_HOME_URL, useValue: home }] : []),
    ],
  });
  const route = { queryParamMap: convertToParamMap(params) } as ActivatedRouteSnapshot;
  const result = TestBed.runInInjectionContext(() =>
    guestGuard(route, {} as RouterStateSnapshot),
  );
  return result instanceof UrlTree ? result.toString() : (result as boolean);
}

describe('guestGuard', () => {
  it('lets guests in', () => {
    expect(run({}, { signedIn: false })).toBe(true);
  });

  it('lets a signed-in user through on a link with a token', () => {
    expect(run({ token: 'abc' })).toBe(true);
  });

  it('sends a signed-in user to an in-app returnUrl', () => {
    expect(run({ returnUrl: '/groups/1' })).toBe('/groups/1');
  });

  it("sends a signed-in user home when returnUrl is missing or leaves the app", () => {
    expect(run({})).toBe('/home');
    expect(run({ returnUrl: 'https://evil.com' })).toBe('/home');
  });

  it("uses the app's home", () => {
    expect(run({}, { home: '/tabs/home' })).toBe('/tabs/home');
  });
});
