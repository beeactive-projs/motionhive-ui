import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { environment } from 'core';

import {
  FACEBOOK_SIGN_IN_PLATFORM,
  FACEBOOK_SOCIAL_LOGIN,
  FacebookSignInCancelled,
  FacebookSignInService,
} from './facebook-sign-in.service';

/** What the plugin answers after Facebook's sheet. */
function facebookAnswer(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'facebook',
    result: {
      accessToken: null,
      idToken: '',
      isLimitedLogin: false,
      profile: { userID: 'fb-user-1', email: 'ana@example.com', name: 'Ana Pop' },
      ...overrides,
    },
  };
}

/** An iPhone Limited Login: an ID token and no Graph access token. */
const limitedAnswer = () => facebookAnswer({ idToken: 'facebook.id.token', isLimitedLogin: true });

/** An Android sign in that kept its access token. */
const classicAnswer = () => facebookAnswer({ accessToken: { token: 'graph-token' } });

describe('FacebookSignInService (Continue with Facebook in the app)', () => {
  const plugin = {
    initialize: vi.fn(),
    login: vi.fn(),
    getAuthorizationCode: vi.fn(),
  };

  function setup(platform: string): FacebookSignInService {
    TestBed.configureTestingModule({
      providers: [
        { provide: FACEBOOK_SOCIAL_LOGIN, useValue: plugin },
        { provide: FACEBOOK_SIGN_IN_PLATFORM, useValue: platform },
      ],
    });
    return TestBed.inject(FacebookSignInService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    plugin.initialize.mockReset().mockResolvedValue(undefined);
    plugin.login.mockReset().mockResolvedValue(limitedAnswer());
    plugin.getAuthorizationCode.mockReset().mockResolvedValue({ accessToken: 'current-graph-token' });
  });

  it('is offered on iPhone and Android, not in the browser', () => {
    expect(setup('ios').available).toBe(true);
    TestBed.resetTestingModule();
    expect(setup('android').available).toBe(true);
    TestBed.resetTestingModule();
    expect(setup('web').available).toBe(false);
  });

  it("sets up Facebook alone, once, with the app's id and client token", async () => {
    const service = setup('ios');
    await service.signIn();
    await service.signIn();

    expect(plugin.initialize).toHaveBeenCalledTimes(1);
    expect(plugin.initialize).toHaveBeenCalledWith({
      facebook: { appId: environment.facebookAppId, clientToken: expect.stringMatching(/^[0-9a-f]{32}$/) },
    });
  });

  it('retries the plugin setup after it failed', async () => {
    const service = setup('ios');
    plugin.initialize.mockRejectedValueOnce(new Error('not ready'));
    await expect(service.signIn()).rejects.toThrow('not ready');

    await service.signIn();
    expect(plugin.initialize).toHaveBeenCalledTimes(2);
  });

  describe('on iPhone', () => {
    it('uses Limited Login with a fresh nonce, and gives the API the ID token and that same nonce', async () => {
      const request = await setup('ios').signIn();

      expect(request).toEqual({ idToken: 'facebook.id.token', rawNonce: expect.stringMatching(/^[0-9a-f]{64}$/) });
      expect(plugin.login).toHaveBeenCalledWith({
        provider: 'facebook',
        options: { permissions: ['email', 'public_profile'], limitedLogin: true, nonce: request.rawNonce },
      });
    });

    it('makes a new nonce for every sign in', async () => {
      const service = setup('ios');
      const first = await service.signIn();
      const second = await service.signIn();

      expect(first.rawNonce).not.toBe(second.rawNonce);
    });

    it('fails without an ID token, never falling back to an access token', async () => {
      plugin.login.mockResolvedValue(facebookAnswer({ idToken: '', accessToken: { token: 'graph-token' } }));

      await expect(setup('ios').signIn()).rejects.toThrow();
      expect(plugin.getAuthorizationCode).not.toHaveBeenCalled();
    });
  });

  describe('on Android', () => {
    it('uses classic login with no nonce, and gives the API the access token alone', async () => {
      plugin.login.mockResolvedValue(classicAnswer());
      const request = await setup('android').signIn();

      expect(request).toEqual({ accessToken: 'graph-token' });
      expect(plugin.login).toHaveBeenCalledWith({
        provider: 'facebook',
        options: { permissions: ['email', 'public_profile'] },
      });
      expect(plugin.getAuthorizationCode).not.toHaveBeenCalled();
    });

    it("takes the SDK's current access token when the plugin left it out beside an ID token", async () => {
      plugin.login.mockResolvedValue(limitedAnswer());
      const request = await setup('android').signIn();

      expect(request).toEqual({ accessToken: 'current-graph-token' });
      expect(plugin.getAuthorizationCode).toHaveBeenCalledWith({ provider: 'facebook' });
    });

    it('fails when there is no access token at all', async () => {
      plugin.login.mockResolvedValue(limitedAnswer());
      plugin.getAuthorizationCode.mockResolvedValue({});

      await expect(setup('android').signIn()).rejects.toThrow();
    });
  });

  it('tells a closed sheet apart from a failure', async () => {
    const service = setup('ios');
    plugin.login.mockRejectedValue(Object.assign(new Error('Login cancelled'), { code: 'USER_CANCELLED' }));
    await expect(service.signIn()).rejects.toBeInstanceOf(FacebookSignInCancelled);

    plugin.login.mockRejectedValue(new Error('The operation could not be completed'));
    await expect(service.signIn()).rejects.not.toBeInstanceOf(FacebookSignInCancelled);
  });
});
