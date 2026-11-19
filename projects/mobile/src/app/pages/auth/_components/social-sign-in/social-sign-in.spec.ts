import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { FacebookLoginRequest } from 'core';

import { APPLE_SIGN_IN_PLATFORM, APPLE_SOCIAL_LOGIN } from '../../apple-sign-in.service';
import {
  FACEBOOK_SIGN_IN_PLATFORM,
  FACEBOOK_SOCIAL_LOGIN,
  FacebookSignInCancelled,
  FacebookSignInService,
} from '../../facebook-sign-in.service';
import { GoogleSignInService } from '../../google-sign-in.service';
import { SocialSignIn } from './social-sign-in';

const PROVIDERS = ['google', 'apple', 'facebook'];

/**
 * Builds the buttons on `platform`. Apple's and Facebook's availability are
 * their services' own, read from the platform; Facebook's sign in is
 * `facebookSignIn` when given.
 */
function build(
  platform: string,
  googleAvailable: boolean,
  facebookSignIn?: () => Promise<FacebookLoginRequest>,
) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: APPLE_SIGN_IN_PLATFORM, useValue: platform },
      { provide: APPLE_SOCIAL_LOGIN, useValue: { initialize: vi.fn(), login: vi.fn(), logout: vi.fn() } },
      { provide: GoogleSignInService, useValue: { available: googleAvailable, signIn: vi.fn() } },
      { provide: FACEBOOK_SIGN_IN_PLATFORM, useValue: platform },
      {
        provide: FACEBOOK_SOCIAL_LOGIN,
        useValue: { initialize: vi.fn(), login: vi.fn(), getAuthorizationCode: vi.fn() },
      },
    ],
  });
  if (facebookSignIn) {
    vi.spyOn(TestBed.inject(FacebookSignInService), 'signIn').mockImplementation(facebookSignIn);
  }
  const fixture = TestBed.createComponent(SocialSignIn);
  fixture.detectChanges();
  return fixture;
}

/** The buttons the component draws, top to bottom, by class. */
function render(platform: string, googleAvailable: boolean): string[] {
  const host = build(platform, googleAvailable).nativeElement as HTMLElement;
  const drawn: string[] = [];
  if (host.querySelector('.divider')) {
    drawn.push('divider');
  }
  for (const button of Array.from(host.querySelectorAll('ion-button'))) {
    drawn.push(button.className.split(' ').filter((name) => PROVIDERS.includes(name))[0]);
  }
  return drawn;
}

describe('SocialSignIn (the app)', () => {
  it('puts Google first, then Apple, then Facebook on iPhone', () => {
    expect(render('ios', true)).toEqual(['divider', 'google', 'apple', 'facebook']);
  });

  it('has Google and Facebook on Android, without Apple', () => {
    expect(render('android', true)).toEqual(['divider', 'google', 'facebook']);
  });

  it('has neither Apple nor Facebook in the browser', () => {
    expect(render('web', true)).toEqual(['divider', 'google']);
  });

  it('keeps Apple and Facebook when Google has no client on this platform', () => {
    expect(render('ios', false)).toEqual(['divider', 'apple', 'facebook']);
  });

  it('draws nothing, not even the divider, with no provider', () => {
    expect(render('web', false)).toEqual([]);
  });

  describe('Continue with Facebook', () => {
    const request: FacebookLoginRequest = { idToken: 'facebook.id.token', rawNonce: 'b'.repeat(64) };

    it('hands the page the request, and locks every button while the sheet is open', async () => {
      let finish: (value: FacebookLoginRequest) => void = () => undefined;
      const signIn = vi.fn(() => new Promise<FacebookLoginRequest>((resolve) => (finish = resolve)));
      const fixture = build('ios', true, signIn);
      const component = fixture.componentInstance;
      const credentials: FacebookLoginRequest[] = [];
      component.facebookCredential.subscribe((value) => credentials.push(value));

      const pending = component['signInWithFacebook']();
      expect(component['facebookPending']()).toBe(true);
      expect(component['locked']()).toBe(true);
      // A second tap, on Facebook or another provider, opens nothing.
      await component['signInWithFacebook']();
      await component['signInWithGoogle']();
      expect(signIn).toHaveBeenCalledTimes(1);

      finish(request);
      await pending;
      expect(credentials).toEqual([request]);
      expect(component['locked']()).toBe(false);
    });

    it('stays quiet when the person closes the sheet', async () => {
      const fixture = build('ios', true, vi.fn().mockRejectedValue(new FacebookSignInCancelled()));
      const failed = vi.fn();
      fixture.componentInstance.facebookFailed.subscribe(failed);

      await fixture.componentInstance['signInWithFacebook']();

      expect(failed).not.toHaveBeenCalled();
      expect(fixture.componentInstance['facebookPending']()).toBe(false);
    });

    it('tells the page when the sign in failed', async () => {
      const fixture = build('android', true, vi.fn().mockRejectedValue(new Error('No access token')));
      const failed = vi.fn();
      fixture.componentInstance.facebookFailed.subscribe(failed);

      await fixture.componentInstance['signInWithFacebook']();

      expect(failed).toHaveBeenCalledTimes(1);
    });

    it('opens nothing while the page is already signing in', async () => {
      const signIn = vi.fn(() => Promise.resolve(request));
      const fixture = build('ios', true, signIn);
      fixture.componentRef.setInput('disabled', true);

      await fixture.componentInstance['signInWithFacebook']();

      expect(signIn).not.toHaveBeenCalled();
    });
  });
});
