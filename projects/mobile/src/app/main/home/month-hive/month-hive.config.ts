import { WorkoutLog, WorkoutLogStatus, localDayKey, sentenceCase, weekStart } from 'core';
import {
  barbellOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudOfflineOutline,
  trophyOutline,
} from 'ionicons/icons';

import {
  BoardCell,
  BoardLooks,
  BoardRings,
  boardCell,
  timelineDayKey,
  weekRowPlaces,
} from '../_components/hive-board/hive-board.config';
import { Translate, knownDuration } from '../home.config';

/**
 * The pure half of the trainee's month hive (`/tabs/home/month`): which
 * month is on screen and where the arrows may go, the month's days as
 * honeycomb rows, what each day shows, and the line that sums the month
 * up. Tested in `month-hive.config.spec.ts`; the page only loads, routes
 * and draws.
 */

/**
 * Every icon the page renders. `month-hive.config.spec.ts` fails when this
 * and the template disagree.
 */
export const MONTH_HIVE_ICONS = {
  barbellOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudOfflineOutline,
  trophyOutline,
};

// ─── The month ───────────────────────────────────────────────────

/** Local midnight on the first of `date`'s month. */
export function monthOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The month `delta` months from `month`. */
export function shiftMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

/** `yyyy-mm`: the key a month's data is kept under. */
export function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

/** Next stops at the month we are in: there is nothing ahead to show. */
export function canGoNext(month: Date, today: Date): boolean {
  return monthOf(month).getTime() < monthOf(today).getTime();
}

/** "November 2026", "noiembrie 2026": the month inside a sentence. */
export function monthName(month: Date, locale: string): string {
  return month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** "November 2026", "Noiembrie 2026": the page's title. */
export function monthTitle(month: Date, locale: string): string {
  return sentenceCase(monthName(month, locale), locale);
}

/** The month's own window, from its first local midnight to the next month's. */
export function monthWindow(month: Date): { dateFrom: string; dateTo: string } {
  const from = monthOf(month);
  return { dateFrom: from.toISOString(), dateTo: shiftMonth(from, 1).toISOString() };
}

/**
 * The month as whole weeks, Monday first (ISO): from the Monday on or
 * before the 1st to the Sunday on or after the last day. Day keys, local.
 */
export function monthWeeks(month: Date): string[][] {
  const first = monthOf(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const start = weekStart(first);
  const weeks: string[][] = [];
  for (let day = start; day <= last; ) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(localDayKey(day));
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ─── The days ────────────────────────────────────────────────────

export interface MonthDay {
  /** `yyyy-mm-dd`, local. */
  key: string;
  /** Day of the month, "7". */
  number: number;
  inMonth: boolean;
  /** After today. */
  future: boolean;
  isToday: boolean;
  /** The day's finished workouts, the latest first. */
  workouts: WorkoutLog[];
  /** A plan day skipped, with nothing finished on it. */
  skipped: boolean;
  record: boolean;
  /** The latest of its workouts with a photo. */
  photo: WorkoutLog | null;
}

function endedAt(log: WorkoutLog): number {
  return new Date(log.completedAt ?? log.startedAt).getTime();
}

/** Every day of the month's weeks, in board order, with what happened on it. */
export function monthDays(month: Date, today: Date, logs: readonly WorkoutLog[]): MonthDay[] {
  const todayKey = localDayKey(today);
  const monthPrefix = monthKey(month);
  const finished = new Map<string, WorkoutLog[]>();
  const skipped = new Set<string>();
  for (const log of logs) {
    const key = timelineDayKey(log);
    if (log.status === WorkoutLogStatus.Completed) {
      finished.set(key, [...(finished.get(key) ?? []), log]);
    } else if (log.status === WorkoutLogStatus.Skipped) {
      skipped.add(key);
    }
  }

  return monthWeeks(month)
    .flat()
    .map((key) => {
      const workouts = [...(finished.get(key) ?? [])].sort((a, b) => endedAt(b) - endedAt(a));
      return {
        key,
        number: Number(key.slice(8)),
        inMonth: key.startsWith(monthPrefix),
        future: key > todayKey,
        isToday: key === todayKey,
        workouts,
        skipped: workouts.length === 0 && skipped.has(key),
        record: workouts.some((log) => (log.prCount ?? 0) > 0),
        photo: workouts.find((log) => log.hasPhoto) ?? null,
      };
    });
}

/** What the cell builder needs besides the days. */
export interface MonthCopy {
  t: Translate;
  /** "Tuesday 7 October", in the reader's language. */
  dateLabel: (key: string) => string;
  /** A photo's object URL once it has loaded, else null. */
  photoUrl: (log: WorkoutLog) => string | null;
}

/**
 * The month as honeycomb rows. A trained day is full honey (or its photo,
 * ringed in honey), with a dot for a record; a skipped day a dashed edge;
 * any other past day an empty cell; days to come and days of the other
 * months ghosts. Today wears the ring. Only a trained day is a button.
 */
export function monthCells(days: readonly MonthDay[], copy: MonthCopy): BoardCell[] {
  const places = weekRowPlaces(days.length / 7);
  return days.map((day, i) => {
    const place = places[i]!;
    if (!day.inMonth) return boardCell(place, day.key, BoardLooks.Ghost);
    const ring = day.isToday ? BoardRings.Today : null;
    const label = String(day.number);
    if (day.future) return boardCell(place, day.key, BoardLooks.Ghost, { label, faded: true });
    if (day.workouts.length) {
      const photoUrl = day.photo ? copy.photoUrl(day.photo) : null;
      return boardCell(place, day.key, BoardLooks.Solid, {
        fill: 1,
        label,
        ring: ring ?? (photoUrl ? BoardRings.Trained : null),
        dot: day.record,
        photoUrl,
        name: dayName(day, copy),
      });
    }
    if (day.skipped) return boardCell(place, day.key, BoardLooks.Dashed, { label, ring });
    return boardCell(place, day.key, BoardLooks.Solid, { label, ring });
  });
}

/** While the month is on its way: its shape, every day a ghost with its number. */
export function ghostMonthCells(days: readonly MonthDay[]): BoardCell[] {
  const places = weekRowPlaces(days.length / 7);
  return days.map((day, i) =>
    boardCell(places[i]!, day.key, BoardLooks.Ghost, {
      label: day.inMonth ? String(day.number) : '',
    }),
  );
}

/** "Tuesday 7 October: Upper body, 2 records, with a photo". */
export function dayName(day: MonthDay, copy: MonthCopy): string {
  const parts = [
    day.workouts.length === 1
      ? day.workouts[0]!.name
      : copy.t('monthHive.day.workouts', { count: day.workouts.length }),
  ];
  const records = day.workouts.reduce((sum, log) => sum + (log.prCount ?? 0), 0);
  if (records) parts.push(copy.t('monthHive.summary.records', { count: records }));
  if (day.photo) parts.push(copy.t('monthHive.day.photo'));
  return copy.t('monthHive.day.label', { date: copy.dateLabel(day.key), what: parts.join(', ') });
}

// ─── The month in one line ───────────────────────────────────────

export interface MonthSummary {
  workouts: number;
  records: number;
  /** Known workout time, in seconds. */
  seconds: number;
  skipped: number;
}

/** The month's own days only: a workout in a neighbouring month's week is that month's. */
export function monthSummary(days: readonly MonthDay[]): MonthSummary {
  const own = days.filter((day) => day.inMonth);
  const workouts = own.flatMap((day) => day.workouts);
  return {
    workouts: workouts.length,
    records: workouts.reduce((sum, log) => sum + (log.prCount ?? 0), 0),
    seconds: workouts.reduce((sum, log) => sum + (knownDuration(log.durationSeconds) ?? 0), 0),
    skipped: own.filter((day) => day.skipped).length,
  };
}

/** "2 records · 7h 16m · 1 skipped": only what the month has. */
export function summaryParts(
  summary: MonthSummary,
  t: Translate,
  duration: (seconds: number) => string,
): string[] {
  const parts: string[] = [];
  if (summary.records) parts.push(t('monthHive.summary.records', { count: summary.records }));
  if (summary.seconds) parts.push(duration(summary.seconds));
  if (summary.skipped) parts.push(t('monthHive.summary.skipped', { count: summary.skipped }));
  return parts;
}

// ─── Opening a day ───────────────────────────────────────────────

export interface DayRow {
  id: string;
  title: string;
  detail: string;
  record: boolean;
}

/** One of a day's workouts in the day's sheet: its name, when, how long, its records. */
export function dayRow(
  log: WorkoutLog,
  t: Translate,
  time: (iso: string) => string,
  duration: (seconds: number) => string,
): DayRow {
  const parts = [time(log.completedAt ?? log.startedAt)];
  const seconds = knownDuration(log.durationSeconds);
  if (seconds) parts.push(duration(seconds));
  const records = log.prCount ?? 0;
  if (records) parts.push(t('monthHive.summary.records', { count: records }));
  return { id: log.id, title: log.name, detail: parts.join(' · '), record: records > 0 };
}
