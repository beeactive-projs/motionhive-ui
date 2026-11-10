import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { APPLE_SIGN_IN_PLATFORM, APPLE_SOCIAL_LOGIN } from '../../apple-sign-in.service';
import { GoogleSignInService } from '../../google-sign-in.service';
import { SocialSignIn } from './social-sign-in';

/** The buttons the component draws, top to bottom, by class. */
function render(platform: string, googleAvailable: boolean): string[] {
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: APPLE_SIGN_IN_PLATFORM, useValue: platform },
      { provide: APPLE_SOCIAL_LOGIN, useValue: { initialize: vi.fn(), login: vi.fn(), logout: vi.fn() } },
      { provide: GoogleSignInService, useValue: { available: googleAvailable, signIn: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(SocialSignIn);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const drawn: string[] = [];
  if (host.querySelector('.divider')) {
    drawn.push('divider');
  }
  for (const button of Array.from(host.querySelectorAll('ion-button'))) {
    drawn.push(button.className.split(' ').filter((name) => name === 'apple' || name === 'google')[0]);
  }
  return drawn;
}

describe('SocialSignIn (the app)', () => {
  it('puts Apple first on iPhone, above Google', () => {
    expect(render('ios', true)).toEqual(['divider', 'apple', 'google']);
  });

  it('has no Apple button on Android or in the browser', () => {
    expect(render('android', true)).toEqual(['divider', 'google']);
    TestBed.resetTestingModule();
    expect(render('web', true)).toEqual(['divider', 'google']);
  });

  it('keeps Apple when Google has no client on this platform', () => {
    expect(render('ios', false)).toEqual(['divider', 'apple']);
  });

  it('draws nothing, not even the divider, with neither', () => {
    expect(render('android', false)).toEqual([]);
  });
});
