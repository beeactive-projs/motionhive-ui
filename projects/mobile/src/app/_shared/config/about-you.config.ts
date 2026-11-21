import { GenderLabels, Genders, appLocale, translate } from 'core';
import type { Gender, SetAboutYouPayload } from 'core';

/**
 * Birthday and gender: both optional, purely informational (no age gate),
 * asked by the welcome flow's last step and kept in Account's personal
 * details. Others never get the date: a coach, or anyone the person allows,
 * reads the age the API works out from it.
 */

/** The earliest birthday the picker offers. */
export const BIRTHDAY_MIN = '1900-01-01';

export interface GenderChoice {
  gender: Gender;
  /** Translation key. */
  label: string;
}

/** The owner's three choices, in their order (2026-11-21). */
export const GENDER_CHOICES: readonly GenderChoice[] = [
  { gender: Genders.Male, label: 'enum.gender.MALE' },
  { gender: Genders.Female, label: 'enum.gender.FEMALE' },
  { gender: Genders.PreferNotToSay, label: 'enum.gender.PREFER_NOT_TO_SAY' },
];

/** What the person said about themselves; null is not said. */
export interface AboutYouAnswers {
  birthDate: string | null;
  gender: Gender | null;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Where the birthday wheel opens when there is no birthday yet: 1 January,
 * 30 years back. Opened on today, a Done without a spin saved today as the
 * birthday; a birth year is decades back, so the wheel starts in them.
 */
export function defaultBirthdayStart(now: Date = new Date()): string {
  return `${now.getFullYear() - 30}-01-01`;
}

/** Today on this phone's calendar, `YYYY-MM-DD`: the latest birthday the picker offers. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The calendar day a `YYYY-MM-DD` names, at local midnight; null when it names none. */
function localDay(iso: string): Date | null {
  const match = ISO_DAY.exec(iso);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * The day `ion-datetime` handed back, as `YYYY-MM-DD`. A date presentation
 * gives the day alone, but a value it started from may carry a time after
 * it; a multiple pick (never used here) or nothing is no day.
 */
export function pickedDay(value: string | string[] | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_DAY.exec(value);
  if (!match || !localDay(match[0])) {
    return null;
  }
  return match[0];
}

/**
 * A saved birthday as the person reads it, "14 March 1992" in the app's
 * language. Read as a calendar day, never as an instant: parsed as UTC it
 * would be the day before anywhere west of Greenwich.
 */
export function birthdayLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) {
    return null;
  }
  const date = localDay(birthDate);
  if (!date) {
    return null;
  }
  return date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** A gender the API sent, or null for none (or a value this app does not know). */
export function toGender(value: string | null | undefined): Gender | null {
  for (const gender of Object.values(Genders)) {
    if (gender === value) {
      return gender;
    }
  }
  return null;
}

/** A gender's label in the app's language; empty for none. */
export function genderLabel(gender: Gender | null | undefined): string {
  if (!gender) {
    return '';
  }
  return GenderLabels[gender];
}

/** Done needs one answer at least; with none, Skip is the way on. */
export function hasAboutYouAnswer(answers: AboutYouAnswers): boolean {
  return answers.birthDate !== null || answers.gender !== null;
}

/**
 * What the step saves: the answers that changed from what the account had,
 * a cleared one as null. Only the fields sent are saved, so an answer left
 * as it was is not sent again.
 */
export function aboutYouPayload(answers: AboutYouAnswers, before: AboutYouAnswers): SetAboutYouPayload {
  const payload: SetAboutYouPayload = {};
  if (answers.birthDate !== before.birthDate) {
    payload.birthDate = answers.birthDate;
  }
  if (answers.gender !== before.gender) {
    payload.gender = answers.gender;
  }
  return payload;
}

/**
 * What a coach reads about a client beside their name: "32 years", "Woman".
 * The API sends either only when the client lets their coaches see it.
 * "Prefer not to say" is a choice to say nothing, so nothing is shown.
 */
export function ageAndGenderParts(
  age: number | null | undefined,
  gender: Gender | null | undefined,
): string[] {
  const parts: string[] = [];
  if (typeof age === 'number' && Number.isFinite(age) && age >= 0) {
    parts.push(translate('count.years', { count: age }));
  }
  if (gender && gender !== Genders.PreferNotToSay) {
    parts.push(GenderLabels[gender]);
  }
  return parts;
}
