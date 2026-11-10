import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { sha256Hex } from 'core';

import {
  APPLE_SIGN_IN_PLATFORM,
  APPLE_SOCIAL_LOGIN,
  AppleSignInCancelled,
  AppleSignInService,
} from './apple-sign-in.service';

/** What the plugin answers on iOS after Apple's sheet. */
function appleAnswer(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'apple',
    result: {
      accessToken: null,
      idToken: 'apple.identity.token',
      authorizationCode: 'one-time-code',
      profile: { user: 'apple-user-1', email: 'x@privaterelay.appleid.com', givenName: ' Ana ', familyName: 'Pop' },
      ...overrides,
    },
  };
}

describe('AppleSignInService (Sign in with Apple in the app)', () => {
  const plugin = {
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };

  function setup(platform: string): AppleSignInService {
    TestBed.configureTestingModule({
      providers: [
        { provide: APPLE_SOCIAL_LOGIN, useValue: plugin },
        { provide: APPLE_SIGN_IN_PLATFORM, useValue: platform },
      ],
    });
    return TestBed.inject(AppleSignInService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    plugin.initialize.mockReset().mockResolvedValue(undefined);
    plugin.login.mockReset().mockResolvedValue(appleAnswer());
    plugin.logout.mockReset().mockResolvedValue(undefined);
  });

  it('is offered on iPhone only', () => {
    expect(setup('ios').available).toBe(true);
    TestBed.resetTestingModule();
    expect(setup('android').available).toBe(false);
    TestBed.resetTestingModule();
    expect(setup('web').available).toBe(false);
  });

  it('sets the plugin up once, with no redirect and with the one-time code returned', async () => {
    const service = setup('ios');
    await service.signIn();
    await service.signIn();

    expect(plugin.initialize).toHaveBeenCalledTimes(1);
    expect(plugin.initialize).toHaveBeenCalledWith({ apple: { redirectUrl: '', useProperTokenExchange: true } });
  });

  it('gives Apple the hash of the nonce and the API the nonce, the code and the name', async () => {
    const request = await setup('ios').signIn();

    expect(request).toEqual({
      identityToken: 'apple.identity.token',
      rawNonce: expect.stringMatching(/^[0-9a-f]{64}$/),
      authorizationCode: 'one-time-code',
      firstName: 'Ana',
      lastName: 'Pop',
    });
    const options = plugin.login.mock.calls[0][0];
    expect(options.provider).toBe('apple');
    expect(options.options.nonce).toBe(await sha256Hex(request.rawNonce));
  });

  it('sends no name when Apple gave none (the plugin sends empty strings)', async () => {
    plugin.login.mockResolvedValue(
      appleAnswer({ authorizationCode: undefined, profile: { user: 'u', email: null, givenName: '', familyName: '' } }),
    );
    const request = await setup('ios').signIn();

    expect(request).toEqual({ identityToken: 'apple.identity.token', rawNonce: expect.any(String) });
  });

  it('tells a closed sheet apart from a failure', async () => {
    const service = setup('ios');
    plugin.login.mockRejectedValue(Object.assign(new Error('The user canceled'), { code: 'USER_CANCELLED' }));
    await expect(service.signIn()).rejects.toBeInstanceOf(AppleSignInCancelled);

    plugin.login.mockRejectedValue(new Error('The operation could not be completed'));
    await expect(service.signIn()).rejects.not.toBeInstanceOf(AppleSignInCancelled);
  });

  it('fails without an identity token', async () => {
    plugin.login.mockResolvedValue(appleAnswer({ idToken: null }));
    await expect(setup('ios').signIn()).rejects.toThrow();
  });

  it('retries the plugin setup after it failed', async () => {
    const service = setup('ios');
    plugin.initialize.mockRejectedValueOnce(new Error('not ready'));
    await expect(service.signIn()).rejects.toThrow('not ready');

    await service.signIn();
    expect(plugin.initialize).toHaveBeenCalledTimes(2);
  });

  describe('when the account is deleted', () => {
    it('clears the name the plugin keeps on the phone', async () => {
      await setup('ios').clearCachedName();
      expect(plugin.logout).toHaveBeenCalledWith({ provider: 'apple', clearCachedUserInfo: true });
    });

    it('never fails the deletion', async () => {
      plugin.logout.mockRejectedValue(new Error('Not logged in; Cannot logout'));
      await expect(setup('ios').clearCachedName()).resolves.toBeUndefined();
    });

    it('does nothing off iPhone', async () => {
      await setup('android').clearCachedName();
      expect(plugin.logout).not.toHaveBeenCalled();
    });
  });
});
