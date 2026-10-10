/**
 * Date helpers shared across calendar surfaces.
 *
 * Local-zone aware — never round-trips through UTC because midnight in
 * one zone can land on a different calendar day in another.
 */

import { appLocale } from '../i18n/app-language';

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** ISO 8601 week start (Monday) for the week containing `d`. */
export function weekStart(d: Date): Date {
  const out = new Date(d);
  const dayOffset = (d.getDay() + 6) % 7;
  out.setDate(d.getDate() - dayOffset);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Local calendar day as `yyyy-mm-dd`. Not `iso.slice(0, 10)` — that is the UTC
 * day, so west of Greenwich an evening lands on tomorrow's key.
 */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The inverse of `localDayKey` — 'yyyy-mm-dd' back to a local midnight. */
export function dayFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Local midnight on the first of the month containing `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Calendar-relative short time: `08:00` today, `Wed` inside the last week,
 * `9 Aug` before that.
 *
 * The counterpart to `formatRelativeShort`. Use this where a day divider or a
 * date column already establishes *which* day — "2h" next to a "Today" heading
 * says the same thing twice.
 */
export function formatCalendarShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (sameDay(date, now)) {
    return date.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
  }

  const daysAgo = (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000;
  if (daysAgo > 0 && daysAgo < 7) {
    return date.toLocaleDateString(appLocale(), { weekday: 'short' });
  }

  return date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/**
 * Weekday names in the UI locale, Monday first (ISO order, matching
 * `weekStart`): `'narrow'` → M T W…, `'short'` → Mon Tue…, `'long'` → Monday….
 *
 * Replaces hand-written `['M', 'T', …]` / `['Mon', …]` arrays, which can't
 * follow the language.
 */
export function weekdayNames(style: 'narrow' | 'short' | 'long' = 'short'): string[] {
  const format = new Intl.DateTimeFormat(appLocale(), { weekday: style });
  // 1 January 2024 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 1 + i)));
}

/** Month names in the UI locale, January first. */
export function monthNames(style: 'short' | 'long' = 'long'): string[] {
  const format = new Intl.DateTimeFormat(appLocale(), { month: style });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2024, i, 1)));
}
