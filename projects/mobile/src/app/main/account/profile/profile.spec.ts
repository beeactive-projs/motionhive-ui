import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { Genders } from 'core';
import type { Gender } from 'core';

import { AccountStore } from '../account.store';
import { Profile } from './profile';

function page(birthDate: string | null, gender: Gender | null): Profile {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AccountStore,
        useValue: {
          account: signal(null),
          isInstructor: signal(false),
          instructorProfile: signal(null),
          birthDate: signal(birthDate),
          gender: signal(gender),
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new Profile());
}

describe('Profile, birthday and gender rows', () => {
  it('says the birthday as a day and the gender in words', () => {
    const profile = page('1992-03-14', Genders.PreferNotToSay);
    expect(profile.birthdayValue()).toBe('14 March 1992');
    expect(profile.genderValue()).toBe('Prefer not to say');
  });

  it('leaves both empty for the rows to say "Not provided"', () => {
    const profile = page(null, null);
    expect(profile.birthdayValue()).toBeNull();
    expect(profile.genderValue()).toBeNull();
  });
});
