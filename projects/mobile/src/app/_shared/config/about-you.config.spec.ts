import { describe, expect, it } from 'vitest';

import { Genders } from 'core';

import {
  BIRTHDAY_MIN,
  GENDER_CHOICES,
  aboutYouPayload,
  ageAndGenderParts,
  birthdayLabel,
  genderLabel,
  hasAboutYouAnswer,
  pickedDay,
  toGender,
  defaultBirthdayStart,
  todayIso,
} from './about-you.config';

describe('gender choices', () => {
  it("offers the owner's three, in order, in their words", () => {
    expect(GENDER_CHOICES.map((choice) => choice.gender)).toEqual(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']);
    expect(GENDER_CHOICES.map((choice) => choice.label)).toEqual([
      'enum.gender.MALE',
      'enum.gender.FEMALE',
      'enum.gender.PREFER_NOT_TO_SAY',
    ]);
    expect(genderLabel(Genders.Male)).toBe('Man');
    expect(genderLabel(Genders.Female)).toBe('Woman');
    expect(genderLabel(Genders.PreferNotToSay)).toBe('Prefer not to say');
    expect(genderLabel(null)).toBe('');
  });

  it('reads only the genders it knows', () => {
    expect(toGender('FEMALE')).toBe('FEMALE');
    expect(toGender('OTHER')).toBeNull();
    expect(toGender(null)).toBeNull();
    expect(toGender(undefined)).toBeNull();
  });
});

describe('the birthday', () => {
  // Opened on today, a Done without a spin saved today as the birthday.
  it('opens the wheel decades back when there is no birthday yet', () => {
    expect(defaultBirthdayStart(new Date(2026, 10, 21))).toBe('1996-01-01');
  });

  it('offers 1900 to today, on the phone calendar', () => {
    expect(BIRTHDAY_MIN).toBe('1900-01-01');
    expect(todayIso(new Date(2026, 10, 21, 23, 30))).toBe('2026-11-21');
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('takes the day the picker hands back, with or without a time', () => {
    expect(pickedDay('1992-03-14')).toBe('1992-03-14');
    expect(pickedDay('1992-03-14T09:00:00')).toBe('1992-03-14');
    expect(pickedDay(['1992-03-14'])).toBeNull();
    expect(pickedDay(null)).toBeNull();
    expect(pickedDay('1992-02-31')).toBeNull();
    expect(pickedDay('March 14')).toBeNull();
  });

  it('reads as a calendar day in the app language, never a day early', () => {
    expect(birthdayLabel('1992-03-14')).toBe('14 March 1992');
    expect(birthdayLabel('2000-01-01')).toBe('1 January 2000');
    expect(birthdayLabel(null)).toBeNull();
    expect(birthdayLabel('not a date')).toBeNull();
  });
});

describe('the about you step', () => {
  const none = { birthDate: null, gender: null };

  it('needs one answer at least', () => {
    expect(hasAboutYouAnswer(none)).toBe(false);
    expect(hasAboutYouAnswer({ birthDate: '1992-03-14', gender: null })).toBe(true);
    expect(hasAboutYouAnswer({ birthDate: null, gender: Genders.PreferNotToSay })).toBe(true);
  });

  it('sends what was answered', () => {
    expect(aboutYouPayload({ birthDate: '1992-03-14', gender: Genders.Female }, none)).toEqual({
      birthDate: '1992-03-14',
      gender: 'FEMALE',
    });
    expect(aboutYouPayload({ birthDate: null, gender: Genders.Male }, none)).toEqual({ gender: 'MALE' });
  });

  it('leaves out what is as it was, and sends a cleared answer as null', () => {
    const before = { birthDate: '1992-03-14', gender: Genders.Female };
    expect(aboutYouPayload(before, before)).toEqual({});
    expect(aboutYouPayload({ birthDate: '1992-03-14', gender: null }, before)).toEqual({ gender: null });
    expect(aboutYouPayload({ birthDate: '1990-01-02', gender: Genders.Female }, before)).toEqual({
      birthDate: '1990-01-02',
    });
  });
});

describe('what a coach reads beside a client', () => {
  it('says the age in years and the gender', () => {
    expect(ageAndGenderParts(32, Genders.Female)).toEqual(['32 years', 'Woman']);
    expect(ageAndGenderParts(1, Genders.Male)).toEqual(['1 year', 'Man']);
  });

  it('says nothing for prefer not to say, or for what was not shared', () => {
    expect(ageAndGenderParts(32, Genders.PreferNotToSay)).toEqual(['32 years']);
    expect(ageAndGenderParts(null, Genders.Female)).toEqual(['Woman']);
    expect(ageAndGenderParts(undefined, undefined)).toEqual([]);
  });
});
