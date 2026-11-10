import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { sha256Hex } from '../../utils/apple-sign-in.utils';
import { AppleLoginRequest } from '../../models/auth/social-login.model';
import { AppleAuthService, AppleWebSignInResult } from './apple-auth.service';

interface InitConfig {
  clientId: string;
  scope: string;
  redirectURI: string;
  state: string;
  nonce: string;
  usePopup: boolean;
}

/** A token Apple could have signed: only the claims matter here. */
function identityToken(sub: string): string {
  const claims = btoa(JSON.stringify({ sub })).replace(/=+$/, '');
  return `header.${claims}.signature`;
}

/** The request of a sign in that went through; fails the test otherwise. */
function requestOf(result: AppleWebSignInResult): AppleLoginRequest {
  if (result.status !== 'signed-in') {
    throw new Error(`expected a sign in, got ${result.status}`);
  }
  return result.request;
}

describe('AppleAuthService (Sign in with Apple on the web)', () => {
  let service: AppleAuthService;
  let config: InitConfig | null;
  let answer: (config: InitConfig) => Promise<unknown>;
  const signIn = vi.fn(() => answer(config as InitConfig));

  beforeEach(() => {
    config = null;
    signIn.mockClear();
    answer = (current) =>
      Promise.resolve({
        authorization: { code: 'one-time-code', id_token: identityToken('apple-user-1'), state: current.state },
        user: { email: 'x@privaterelay.appleid.com', name: { firstName: ' Ana ', lastName: 'Pop' } },
      });
    (window as unknown as { AppleID: unknown }).AppleID = {
      auth: {
        init: (next: InitConfig) => (config = next),
        signIn,
      },
    };
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppleAuthService);
  });

  afterEach(() => {
    delete (window as unknown as { AppleID?: unknown }).AppleID;
    sessionStorage.clear();
  });

  it('is not offered off the web app origin registered with Apple (here localhost)', async () => {
    expect(service.available).toBe(false);
    expect(await service.prepare()).toBe(false);
  });

  it('sets Apple up for a popup, with the hash of the nonce it sends the API', async () => {
    const request = requestOf(await service.signIn());

    expect(config).toMatchObject({
      clientId: environment.appleServicesId,
      scope: 'name email',
      redirectURI: `${window.location.origin}/auth/login`,
      usePopup: true,
    });
    expect(request).toEqual({
      identityToken: identityToken('apple-user-1'),
      rawNonce: expect.stringMatching(/^[0-9a-f]{64}$/),
      authorizationCode: 'one-time-code',
      firstName: 'Ana',
      lastName: 'Pop',
    });
    expect(config?.nonce).toBe(await sha256Hex(request.rawNonce));
  });

  it('opens the popup within the click once prepared, before anything is awaited', async () => {
    (service as unknown as { available: boolean }).available = true;
    expect(await service.prepare()).toBe(true);

    const pending = service.signIn();
    expect(signIn).toHaveBeenCalledTimes(1);
    await pending;
  });

  it('uses a fresh nonce for every sign in', async () => {
    const first = requestOf(await service.signIn());
    const second = requestOf(await service.signIn());
    expect(second.rawNonce).not.toBe(first.rawNonce);
  });

  it('treats a closed popup or a no as cancelled, not as a failure', async () => {
    answer = () => Promise.reject({ error: 'popup_closed_by_user' });
    expect(await service.signIn()).toEqual({ status: 'cancelled' });

    answer = () => Promise.reject({ error: 'user_cancelled_authorize' });
    expect(await service.signIn()).toEqual({ status: 'cancelled' });
  });

  it('fails on any other error from Apple', async () => {
    answer = () => Promise.reject({ error: 'popup_blocked_by_browser' });
    await expect(service.signIn()).rejects.toEqual({ error: 'popup_blocked_by_browser' });
  });

  it('refuses an answer carrying another sign in state', async () => {
    answer = () =>
      Promise.resolve({ authorization: { code: 'c', id_token: identityToken('apple-user-1'), state: 'someone-else' } });
    await expect(service.signIn()).rejects.toThrow();
  });

  describe('the name Apple shares only once', () => {
    it('comes back on a retry with the same Apple Account until the API took it', async () => {
      await service.signIn();
      answer = (current) =>
        Promise.resolve({ authorization: { id_token: identityToken('apple-user-1'), state: current.state } });

      const retry = requestOf(await service.signIn());
      expect(retry).toMatchObject({ firstName: 'Ana', lastName: 'Pop' });
      expect('authorizationCode' in retry).toBe(false);

      service.forgetSharedName();
      const after = requestOf(await service.signIn());
      expect('firstName' in after).toBe(false);
    });

    it('never goes to another Apple Account', async () => {
      await service.signIn();
      answer = (current) =>
        Promise.resolve({ authorization: { id_token: identityToken('apple-user-2'), state: current.state } });

      const other = requestOf(await service.signIn());
      expect('firstName' in other).toBe(false);
    });
  });
});
