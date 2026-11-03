import {
  ExerciseProgress,
  ProgressRange,
  VolumeUnit,
  VolumeUnits,
  WeeklyVolumePoint,
  WorkoutVolume,
  appLocale,
  dayFromKey,
  formatTotalDuration,
  localDayKey,
  translate,
  weekStart,
} from 'core';

import type { ChartBar } from './_components/bar-chart/bar-chart';
import {
  TrendPoint,
  formatMeasure,
  inRange,
  rangeStart,
  secondsToClock,
  unbreakable,
} from './workouts.config';

/**
 * Volume on the three screens that show it: an exercise's page (per
 * session), Progress (per week) and a finished workout (against last time).
 * The API decides what counts (working sets only, warm-ups out) and the
 * unit; this file only says it.
 */

type ExerciseSession = ExerciseProgress['sessions'][number];

// ─── Saying a volume ──────────────────────────────────────────────────────

/** Grouped the reader's way: a volume is a total read at a glance. */
function grouped(value: number): string {
  return new Intl.NumberFormat(appLocale(), { maximumFractionDigits: 0 }).format(Math.round(value));
}

/**
 * A volume with its unit: "4,280 kg", "120 reps", "6:30" (an hour or more
 * as "1h 5m"), "5,000 m". The number never goes out without the unit.
 */
export function formatVolume(value: number, unit: VolumeUnit): string {
  switch (unit) {
    case VolumeUnits.Reps:
      return translate('count.reps', { count: Math.round(value) });
    case VolumeUnits.Seconds:
      return value >= 3600 ? formatTotalDuration(value / 60) : secondsToClock(value);
    case VolumeUnits.Meters:
      return translate('workouts.units.meters', { value: grouped(value) });
    default:
      return translate('workouts.units.kg', { value: grouped(value) });
  }
}

/** The minus sign, not a hyphen: the figure reads as a number, not a dash. */
const MINUS = '−';

/** "+340 kg", "−120 kg", "+12 reps". */
export function formatVolumeChange(change: number, unit: VolumeUnit): string {
  const sign = change > 0 ? '+' : change < 0 ? MINUS : '';
  return `${sign}${formatVolume(Math.abs(change), unit)}`;
}

/** "+9%", "−3%", in the reader's locale ("+9 %" in Romanian). */
export function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? '+' : percent < 0 ? MINUS : '';
  const value = new Intl.NumberFormat(appLocale(), { style: 'percent', maximumFractionDigits: 0 })
    .format(Math.abs(percent) / 100);
  return `${sign}${value}`;
}

// ─── A finished workout against last time ─────────────────────────────────

/**
 * The line under the total: "+340 kg vs last Push day (3,940 kg) · +9%",
 * "Same as last Push day (3,940 kg)", or the promise of a comparison when
 * nothing was compared yet. Null when there is no previous workout but some
 * exercises do have a last time: their rows say it.
 */
export function workoutComparisonLine(volume: WorkoutVolume): string | null {
  const previous = volume.previous;
  if (!previous) {
    const anyCompared = volume.exercises.some((exercise) => exercise.previous);
    return anyCompared ? null : translate('workouts.volume.finish.firstTime');
  }
  const change = volume.changeKg ?? volume.totalKg - previous.totalKg;
  // Each figure whole on its line: "(3,940" over "kg)" read as two things.
  const total = unbreakable(formatVolume(previous.totalKg, VolumeUnits.Kg));
  if (change === 0) {
    return translate('workouts.volume.finish.sameAsLast', { name: previous.name, total });
  }
  const params = {
    change: unbreakable(formatVolumeChange(change, VolumeUnits.Kg)),
    name: previous.name,
    total,
  };
  return volume.changePercent == null
    ? translate('workouts.volume.finish.vsLastNoPercent', params)
    : translate('workouts.volume.finish.vsLast', {
        ...params,
        percent: unbreakable(formatPercentChange(volume.changePercent)),
      });
}

export const VolumeTrends = {
  Up: 'up',
  Same: 'same',
  Down: 'down',
} as const;

export type VolumeTrend = (typeof VolumeTrends)[keyof typeof VolumeTrends];

export interface ExerciseVolumeRow {
  loggedExerciseId: string;
  name: string;
  /** "A1": the row's place in a superset, which the card draws with its rail. */
  tag: string | null;
  /** "Superset A", on the first row of a superset only. */
  group: string | null;
  /** Bar widths in percent of the longest bar of the same unit. */
  todayWidth: number;
  /** Null without a last time: only today's bar is drawn. */
  lastWidth: number | null;
  /** "+12%", or "First time"; empty when the change rounds to nothing. */
  change: string;
  trend: VolumeTrend | null;
  /** What the two bars say, for a screen reader. */
  label: string;
}

/**
 * Each exercise as two bars, today and last time. Bars of one unit share a
 * scale, so a long bar means more than a short one of the same kind; reps
 * are never drawn against kilograms.
 */
export function exerciseVolumeRows(
  volume: WorkoutVolume,
  nameOf: (loggedExerciseId: string) => string,
  /** A superset member's tag ("A1"), so the pair reads as one block. */
  tagOf: (loggedExerciseId: string) => string | null = () => null,
): ExerciseVolumeRow[] {
  const longest = new Map<VolumeUnit, number>();
  for (const entry of volume.exercises) {
    const top = Math.max(entry.volume, entry.previous?.volume ?? 0);
    longest.set(entry.unit, Math.max(longest.get(entry.unit) ?? 0, top));
  }
  const width = (value: number, unit: VolumeUnit) =>
    Math.max(2, Math.round((value / (longest.get(unit) || 1)) * 100));

  const seen = new Set<string>();
  return volume.exercises.map((entry) => {
    const name = nameOf(entry.loggedExerciseId);
    const today = formatVolume(entry.volume, entry.unit);
    const tag = tagOf(entry.loggedExerciseId);
    const letter = tag?.replace(/\d+$/, '') ?? null;
    const group =
      letter && !seen.has(letter)
        ? translate('workouts.volume.finish.superset', { letter })
        : null;
    if (letter) seen.add(letter);
    if (!entry.previous) {
      return {
        loggedExerciseId: entry.loggedExerciseId,
        name,
        tag,
        group,
        todayWidth: width(entry.volume, entry.unit),
        lastWidth: null,
        change: translate('workouts.volume.finish.newExercise'),
        trend: null,
        label: translate('workouts.volume.finish.rowLabelNew', { name, today }),
      };
    }
    const percent = entry.changePercent ?? 0;
    return {
      loggedExerciseId: entry.loggedExerciseId,
      name,
      tag,
      group,
      todayWidth: width(entry.volume, entry.unit),
      lastWidth: width(entry.previous.volume, entry.unit),
      change: percent === 0 ? '' : formatPercentChange(percent),
      trend: percent > 0 ? VolumeTrends.Up : percent < 0 ? VolumeTrends.Down : VolumeTrends.Same,
      label: translate('workouts.volume.finish.rowLabel', {
        name,
        today,
        last: formatVolume(entry.previous.volume, entry.unit),
      }),
    };
  });
}

// ─── An exercise's page: 1RM, top set or volume ───────────────────────────

export const ExerciseMetrics = {
  OneRepMax: 'oneRepMax',
  TopSet: 'topSet',
  Volume: 'volume',
} as const;

export type ExerciseMetric = (typeof ExerciseMetrics)[keyof typeof ExerciseMetrics];

/**
 * What the session's best is measured in when nothing is loaded: the
 * longest hold, the furthest distance or the most reps, the way the page's
 * "Best" tile reads it.
 */
export function topSetUnit(sessions: readonly ExerciseSession[]): VolumeUnit | null {
  if (sessions.some((s) => (s.topWeightKg ?? 0) > 0)) return VolumeUnits.Kg;
  if (sessions.some((s) => (s.bestDurationSeconds ?? 0) > 0)) return VolumeUnits.Seconds;
  if (sessions.some((s) => (s.bestDistanceMeters ?? 0) > 0)) return VolumeUnits.Meters;
  if (sessions.some((s) => (s.topReps ?? 0) > 0)) return VolumeUnits.Reps;
  return null;
}

function topSetValue(session: ExerciseSession, unit: VolumeUnit): number | null {
  switch (unit) {
    case VolumeUnits.Kg:
      return session.topWeightKg;
    case VolumeUnits.Seconds:
      return session.bestDurationSeconds;
    case VolumeUnits.Meters:
      return session.bestDistanceMeters;
    default:
      return session.topReps;
  }
}

/** The unit the API measured this exercise's volume in; null from an older API. */
export function volumeUnitOf(sessions: readonly ExerciseSession[]): VolumeUnit | null {
  return sessions.find((s) => s.volumeUnit)?.volumeUnit ?? null;
}

/**
 * The metrics this exercise can show, in the switch's order: the estimated
 * 1RM where there is a series, the top set (or best) and the volume where
 * the sessions carry them.
 */
export function exerciseMetrics(progress: ExerciseProgress): ExerciseMetric[] {
  const metrics: ExerciseMetric[] = [];
  if (progress.oneRepMaxSeries.length > 0) metrics.push(ExerciseMetrics.OneRepMax);
  if (topSetUnit(progress.sessions)) metrics.push(ExerciseMetrics.TopSet);
  if (progress.sessions.some((s) => (s.volume ?? 0) > 0)) metrics.push(ExerciseMetrics.Volume);
  return metrics;
}

/**
 * One point per local day inside the range, oldest first. Two sessions on
 * one day would draw a vertical line: a top set keeps the day's best, a
 * volume adds the day's work up.
 */
function pointsPerDay(
  sessions: readonly ExerciseSession[],
  value: (session: ExerciseSession) => number | null,
  combine: (a: number, b: number) => number,
  range: ProgressRange,
  now: number,
): TrendPoint[] {
  const days = new Map<string, TrendPoint>();
  const ordered = inRange(sessions, (s) => s.performedAt, range, now)
    .filter((s) => new Date(s.performedAt).getTime() <= now)
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
  for (const session of ordered) {
    const y = value(session);
    if (y == null || y <= 0) continue;
    const x = new Date(session.performedAt).getTime();
    const key = localDayKey(new Date(x));
    const day = days.get(key);
    days.set(key, day ? { x: day.x, y: combine(day.y, y) } : { x, y });
  }
  return [...days.values()];
}

/** The top set (or best) of each session in the range, in `unit`. */
export function topSetPoints(
  sessions: readonly ExerciseSession[],
  unit: VolumeUnit,
  range: ProgressRange,
  now: number,
): TrendPoint[] {
  return pointsPerDay(sessions, (s) => topSetValue(s, unit), Math.max, range, now);
}

/** Each session's volume in the range. */
export function volumePoints(
  sessions: readonly ExerciseSession[],
  range: ProgressRange,
  now: number,
): TrendPoint[] {
  return pointsPerDay(sessions, (s) => s.volume ?? null, (a, b) => a + b, range, now);
}

/** The latest point against the first, in whole percent; null under two points. */
export function pointsChangePercent(points: readonly TrendPoint[]): number | null {
  if (points.length < 2 || points[0].y <= 0) return null;
  return Math.round(((points[points.length - 1].y - points[0].y) / points[0].y) * 100);
}

/**
 * "The record hasn't moved since 21 Oct, but you did more at the same
 * weight": the day of the record, when that sentence is true over the range,
 * else null. True when the estimated 1RM was last raised before the range
 * opened, the latest session lifted the same top weight as the range's
 * first, and its volume is higher. Never on a lift with no record yet.
 */
export function recordStillSince(
  progress: ExerciseProgress,
  range: ProgressRange,
  now: number,
): string | null {
  const record = progress.oneRepMaxSeries.at(-1);
  if (!record || new Date(record.recordedAt).getTime() >= rangeStart(range, now)) return null;
  // Newest first, as the API sends them.
  const sessions = inRange(progress.sessions, (s) => s.performedAt, range, now).filter(
    (s) => s.volume != null && s.volumeUnit === VolumeUnits.Kg,
  );
  if (sessions.length < 2) return null;
  const latest = sessions[0];
  const first = sessions[sessions.length - 1];
  const sameWeight =
    latest.topWeightKg != null &&
    latest.topWeightKg > 0 &&
    latest.topWeightKg === first.topWeightKg;
  return sameWeight && (latest.volume ?? 0) > (first.volume ?? 0) ? record.recordedAt : null;
}

/** "21 Oct", with the year when it is not this one. */
export function recordDayLabel(when: string, now: number): string {
  const date = new Date(when);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(appLocale(), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// ─── Progress: the last twelve weeks ──────────────────────────────────────

export const WeekMetrics = {
  Workouts: 'workouts',
  Volume: 'volume',
  Time: 'time',
} as const;

export type WeekMetric = (typeof WeekMetrics)[keyof typeof WeekMetrics];

export const WEEK_METRICS: readonly WeekMetric[] = [
  WeekMetrics.Workouts,
  WeekMetrics.Volume,
  WeekMetrics.Time,
];

/** How many weeks the Progress chart draws, this one last. */
export const CHART_WEEKS = 12;

export interface WeekSlot {
  /** The Monday it starts on, `yyyy-mm-dd`. */
  key: string;
  workouts: number;
  volumeKg: number;
  minutes: number;
}

/**
 * The last `count` weeks, oldest first and this week last, with the weeks
 * the API left out (no workout) as zeros, so the bars keep the calendar's
 * spacing.
 */
export function weekSlots(
  weekly: readonly WeeklyVolumePoint[],
  now: number,
  count = CHART_WEEKS,
): WeekSlot[] {
  const byWeek = new Map(weekly.map((week) => [week.weekStart, week]));
  const monday = weekStart(new Date(now));
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() - (count - 1 - i) * 7);
    const key = localDayKey(start);
    const week = byWeek.get(key);
    return {
      key,
      workouts: week?.workouts ?? 0,
      volumeKg: week?.volumeKg ?? 0,
      minutes: week?.minutes ?? 0,
    };
  });
}

export function weekValue(slot: WeekSlot, metric: WeekMetric): number {
  switch (metric) {
    case WeekMetrics.Volume:
      return slot.volumeKg;
    case WeekMetrics.Time:
      return slot.minutes;
    default:
      return slot.workouts;
  }
}

/** "3 workouts", "11,240 kg", "2h 26m". */
export function formatWeekValue(value: number, metric: WeekMetric): string {
  switch (metric) {
    case WeekMetrics.Volume:
      return formatVolume(value, VolumeUnits.Kg);
    case WeekMetrics.Time:
      return formatTotalDuration(value);
    default:
      return translate('count.workouts', { count: value });
  }
}

/** Bar heights in percent of the tallest; an empty week stays a sliver. */
export function barHeights(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 && value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0));
}

/**
 * The picked week's figure on top of its bar, short enough to sit there:
 * "4.3 t" from a tonne on, "680 kg" under it, "3" workouts, "2h 26m".
 */
export function shortWeekValue(value: number, metric: WeekMetric): string {
  switch (metric) {
    case WeekMetrics.Volume:
      if (value < 1000) return formatVolume(value, VolumeUnits.Kg);
      return translate('workouts.units.tonnes', {
        value: new Intl.NumberFormat(appLocale(), { maximumFractionDigits: 1 }).format(value / 1000),
      });
    case WeekMetrics.Time:
      return formatTotalDuration(value);
    default:
      return grouped(value);
  }
}

// ─── An exercise's volume as bars ─────────────────────────────────────────

export const BarGroupings = {
  /** A bar for each day the exercise was trained. */
  Session: 'session',
  /** A bar for each week: the average of its sessions. */
  Week: 'week',
  /** A bar for each month: the average of its sessions. */
  Month: 'month',
} as const;

export type BarGrouping = (typeof BarGroupings)[keyof typeof BarGroupings];

/** Up to this many sessions get a bar each; past it a bar would be a hairline. */
export const MAX_SESSION_BARS = 24;

/** About this many dates under the bars, the last always among them. */
const BAR_TICKS = 4;

/**
 * The volume per session as bars (Workouts R2, 4a): one a session while they
 * fit, else one a week (one a month over a year), each the average of its
 * sessions, so a bar still reads as "a session's volume". Weeks or months
 * with no session stay as gaps, keeping the calendar's spacing. The last bar
 * is the one the card's figure speaks of: it is the selected one, and with a
 * bar a session it carries that figure on top.
 */
export function volumeBars(
  points: readonly TrendPoint[],
  unit: VolumeUnit,
  range: ProgressRange,
  now: number,
): { grouping: BarGrouping; bars: ChartBar[] } {
  if (points.length <= MAX_SESSION_BARS) {
    const bars = points.map((point, i) => ({
      key: String(point.x),
      value: point.y,
      tick: tickAt(i, points.length) ? dayMonth(point.x) : '',
      label: '',
      top: i === points.length - 1 ? barFigure(point.y, unit) : '',
    }));
    return { grouping: BarGroupings.Session, bars };
  }

  const grouping = range === '1y' ? BarGroupings.Month : BarGroupings.Week;
  const startOf = (time: number): Date => {
    const date = new Date(time);
    return grouping === BarGroupings.Month
      ? new Date(date.getFullYear(), date.getMonth(), 1)
      : weekStart(date);
  };
  const sums = new Map<string, { total: number; count: number }>();
  for (const point of points) {
    const key = localDayKey(startOf(point.x));
    const sum = sums.get(key) ?? { total: 0, count: 0 };
    sums.set(key, { total: sum.total + point.y, count: sum.count + 1 });
  }
  const periods: Date[] = [];
  for (let start = startOf(rangeStart(range, now)); start.getTime() <= now; ) {
    periods.push(start);
    start =
      grouping === BarGroupings.Month
        ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  }
  const bars = periods.map((start, i) => {
    const key = localDayKey(start);
    const sum = sums.get(key);
    const label =
      grouping === BarGroupings.Month
        ? start.toLocaleDateString(appLocale(), { month: 'short' })
        : dayMonth(start.getTime());
    return {
      key,
      value: sum ? Math.round(sum.total / sum.count) : 0,
      tick: tickAt(i, periods.length) ? label : '',
      label: '',
    };
  });
  return { grouping, bars };
}

/** A date under every few bars, counted back from the last. */
function tickAt(index: number, count: number): boolean {
  return (count - 1 - index) % Math.max(1, Math.ceil(count / BAR_TICKS)) === 0;
}

function dayMonth(time: number): string {
  return new Date(time).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/** On top of the last bar: the number alone ("1,920"), the card says the unit. */
function barFigure(value: number, unit: VolumeUnit): string {
  return unit === VolumeUnits.Seconds ? formatVolume(value, unit) : grouped(value);
}

/** "26 Oct" for a week's Monday. */
export function weekDayLabel(key: string): string {
  return dayFromKey(key).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/**
 * A week as History's date bounds: from its Monday's local midnight to the
 * next Monday's, the upper bound exclusive.
 */
export function weekBounds(key: string): { dateFrom: string; dateTo: string } {
  const from = dayFromKey(key);
  const to = new Date(from);
  to.setDate(from.getDate() + 7);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

/**
 * A value on a chart's axis: a clock for a time, a short "12k" past ten
 * thousand (the axis is narrow), else the number as the reader writes it.
 */
export function axisValue(value: number, unit: VolumeUnit | null): string {
  if (unit === VolumeUnits.Seconds) return secondsToClock(value);
  if (Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat(appLocale(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatMeasure(value, 1);
}
