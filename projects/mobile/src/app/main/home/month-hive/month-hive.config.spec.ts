/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { WorkoutLog, WorkoutLogStatus } from 'core';

import { BoardLooks, BoardRings } from '../_components/hive-board/hive-board.config';
import {
  MONTH_HIVE_ICONS,
  MonthCopy,
  canGoNext,
  dayName,
  dayRow,
  ghostMonthCells,
  monthCells,
  monthDays,
  monthKey,
  monthName,
  monthOf,
  monthSummary,
  monthTitle,
  monthWeeks,
  monthWindow,
  shiftMonth,
  summaryParts,
} from './month-hive.config';

const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Static names, kebab literals inside bindings, and `icon: '…'` in the sources. */
function iconNamesUsed(): Set<string> {
  const names = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) names.add(match[1]);
    for (const binding of html.matchAll(/\[(?:name|icon)\]="([^"]*)"/g)) {
      for (const literal of binding[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) names.add(literal[1]);
    }
  }
  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/\bicon: '([a-z][a-z0-9-]*)'/g)) names.add(match[1]);
  }
  return new Set([...names].map(toCamelCase));
}

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

/** A workout finished on a local day of October 2026. */
function log(day: number, overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: `l${day}`,
    userId: 'u1',
    programAssignmentId: null,
    assignedWorkoutId: null,
    name: 'Upper body',
    status: WorkoutLogStatus.Completed,
    startedAt: new Date(2026, 9, day, 17, 0).toISOString(),
    completedAt: new Date(2026, 9, day, 18, 0).toISOString(),
    durationSeconds: 3000,
    feelingRating: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/** A skipped plan day of October, as the timeline sends it: noon UTC on its date. */
function skipped(day: number): WorkoutLog {
  const date = `2026-10-${String(day).padStart(2, '0')}`;
  return log(day, {
    id: `s${day}`,
    status: WorkoutLogStatus.Skipped,
    startedAt: `${date}T12:00:00.000Z`,
    completedAt: null,
    durationSeconds: null,
  });
}

const october = new Date(2026, 9, 1);
const copy: MonthCopy = {
  t,
  dateLabel: (key) => `[${key}]`,
  photoUrl: (one) => (one.hasPhoto ? `blob:${one.id}` : null),
};

describe('MONTH_HIVE_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon the page renders, and nothing else', () => {
    const used = iconNamesUsed();
    const registered = new Set(Object.keys(MONTH_HIVE_ICONS));
    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(name);
    }
    for (const name of registered) {
      expect(used, `${name} is registered but unused`).toContain(name);
    }
  });
});

describe('the month', () => {
  it('steps a month at a time across the year', () => {
    expect(monthKey(shiftMonth(new Date(2026, 11, 1), 1))).toBe('2027-01');
    expect(monthKey(shiftMonth(new Date(2026, 0, 1), -1))).toBe('2025-12');
    expect(monthKey(monthOf(new Date(2026, 10, 18, 22, 0)))).toBe('2026-11');
  });

  // Nothing lies ahead of this month.
  it('lets next go no further than the month we are in', () => {
    const today = new Date(2026, 10, 1, 9, 0);
    expect(canGoNext(october, today)).toBe(true);
    expect(canGoNext(new Date(2026, 10, 1), today)).toBe(false);
  });

  it('names the month for the title, lower case in a sentence where the language says so', () => {
    expect(monthTitle(new Date(2026, 10, 1), 'en-GB')).toBe('November 2026');
    expect(monthTitle(new Date(2026, 10, 1), 'ro-RO')).toBe('Noiembrie 2026');
    expect(monthName(new Date(2026, 10, 1), 'ro-RO')).toBe('noiembrie 2026');
  });

  it('reads from its first local midnight to the next month’s', () => {
    expect(monthWindow(october)).toEqual({
      dateFrom: new Date(2026, 9, 1).toISOString(),
      dateTo: new Date(2026, 10, 1).toISOString(),
    });
  });

  // October 2026 starts on a Thursday and ends on a Saturday; November
  // starts on a Sunday, so its first week is mostly October.
  it('covers the month in whole weeks, Monday first', () => {
    const weeks = monthWeeks(october);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]![0]).toBe('2026-09-28');
    expect(weeks[0]![3]).toBe('2026-10-01');
    expect(weeks[4]![6]).toBe('2026-11-01');
    const november = monthWeeks(new Date(2026, 10, 1));
    expect(november).toHaveLength(6);
    expect(november[0]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(november[5]![0]).toBe('2026-11-30');
  });
});

describe('monthDays', () => {
  const today = new Date(2026, 9, 20, 12, 0);

  it('gathers each day’s workouts, latest first, its record and its photo', () => {
    const days = monthDays(october, today, [
      log(7, {
        id: 'early',
        startedAt: new Date(2026, 9, 7, 7, 0).toISOString(),
        completedAt: new Date(2026, 9, 7, 8, 0).toISOString(),
      }),
      log(7, { id: 'late', prCount: 2, hasPhoto: true, photoVersion: 3 }),
      skipped(5),
      skipped(7),
    ]);
    const seventh = days.find((day) => day.key === '2026-10-07')!;
    expect(seventh.workouts.map((one) => one.id)).toEqual(['late', 'early']);
    expect(seventh.record).toBe(true);
    expect(seventh.photo?.id).toBe('late');
    // A day with a finished workout is not skipped, even if a plan day was.
    expect(seventh.skipped).toBe(false);
    expect(days.find((day) => day.key === '2026-10-05')!.skipped).toBe(true);
  });

  it('knows today, the days to come and the other months’ days', () => {
    const days = monthDays(october, today, []);
    expect(days).toHaveLength(35);
    expect(days.find((day) => day.isToday)?.key).toBe('2026-10-20');
    expect(days.find((day) => day.key === '2026-10-21')?.future).toBe(true);
    expect(days.find((day) => day.key === '2026-09-30')?.inMonth).toBe(false);
    expect(days.find((day) => day.key === '2026-10-31')?.number).toBe(31);
  });
});

describe('monthCells', () => {
  const today = new Date(2026, 9, 20, 12, 0);
  const cellOf = (key: string, logs: WorkoutLog[] = []) =>
    monthCells(monthDays(october, today, logs), copy).find((cell) => cell.key === key)!;

  it('ghosts the other months’ days, without a number', () => {
    expect(cellOf('2026-09-28')).toMatchObject({ look: BoardLooks.Ghost, label: '', name: null });
  });

  it('ghosts the days to come, dimmed, with their number', () => {
    expect(cellOf('2026-10-25')).toMatchObject({
      look: BoardLooks.Ghost,
      label: '25',
      faded: true,
      name: null,
    });
  });

  it('fills a trained day with honey, a record dotted, and makes it a button', () => {
    const cell = cellOf('2026-10-07', [log(7, { prCount: 1 })]);
    expect(cell).toMatchObject({ look: BoardLooks.Solid, fill: 1, label: '7', dot: true });
    const what = `Upper body, ${t('monthHive.summary.records', { count: 1 })}`;
    expect(cell.name).toBe(t('monthHive.day.label', { date: '[2026-10-07]', what }));
  });

  it('shows a day’s photo inside its cell, ringed in honey', () => {
    const cell = cellOf('2026-10-07', [log(7, { hasPhoto: true, photoVersion: 1 })]);
    expect(cell.photoUrl).toBe('blob:l7');
    expect(cell.ring).toBe(BoardRings.Trained);
  });

  it('keeps today’s ring on a trained day', () => {
    expect(cellOf('2026-10-20', [log(20, { hasPhoto: true })]).ring).toBe(BoardRings.Today);
  });

  it('dashes a skipped day and leaves a quiet past day empty, neither a button', () => {
    expect(cellOf('2026-10-05', [skipped(5)])).toMatchObject({
      look: BoardLooks.Dashed,
      name: null,
    });
    expect(cellOf('2026-10-06')).toMatchObject({ look: BoardLooks.Solid, fill: 0, name: null });
    expect(cellOf('2026-10-20').ring).toBe(BoardRings.Today);
  });

  it('lays the month out in week rows, every other one shifted', () => {
    const cells = monthCells(monthDays(october, today, []), copy);
    expect(cells[0]).toMatchObject({ x: 0, y: 0 });
    expect(cells[7]!.x).toBe(0.5);
  });

  it('shows the month’s shape while it loads: every day a ghost', () => {
    const cells = ghostMonthCells(monthDays(october, today, []));
    expect(cells.every((cell) => cell.look === BoardLooks.Ghost && !cell.name)).toBe(true);
    expect(cells.find((cell) => cell.key === '2026-10-01')?.label).toBe('1');
    expect(cells.find((cell) => cell.key === '2026-09-28')?.label).toBe('');
  });
});

describe('dayName', () => {
  it('counts the workouts of a busy day and mentions its photo', () => {
    const [day] = monthDays(october, new Date(2026, 9, 20), [
      log(1, { id: 'a' }),
      log(1, { id: 'b', hasPhoto: true }),
    ]).filter((one) => one.key === '2026-10-01');
    const what = `${t('monthHive.day.workouts', { count: 2 })}, monthHive.day.photo`;
    expect(dayName(day!, copy)).toBe(t('monthHive.day.label', { date: '[2026-10-01]', what }));
  });
});

describe('the month in one line', () => {
  const today = new Date(2026, 10, 1, 9, 0);

  it('adds up only the month’s own days', () => {
    const summary = monthSummary(
      monthDays(october, today, [
        log(7, { prCount: 2 }),
        log(8, { durationSeconds: 9 * 3600 }),
        skipped(5),
        // 1 November sits in October's last week, but is November's.
        log(1, {
          startedAt: new Date(2026, 10, 1, 7, 0).toISOString(),
          completedAt: new Date(2026, 10, 1, 8, 0).toISOString(),
        }),
      ]),
    );
    expect(summary).toEqual({ workouts: 2, records: 2, seconds: 3000, skipped: 1 });
  });

  it('says only what the month has', () => {
    const duration = (seconds: number) => `${seconds / 60}m`;
    const full = { workouts: 3, records: 2, seconds: 3000, skipped: 1 };
    expect(summaryParts(full, t, duration)).toEqual([
      'monthHive.summary.records {"count":2}',
      '50m',
      'monthHive.summary.skipped {"count":1}',
    ]);
    const none = { workouts: 0, records: 0, seconds: 0, skipped: 0 };
    expect(summaryParts(none, t, duration)).toEqual([]);
  });
});

describe('dayRow', () => {
  it('words one of a day’s workouts for its sheet', () => {
    expect(
      dayRow(log(7, { prCount: 1 }), t, () => '18:00', (seconds) => `${seconds / 60}m`),
    ).toEqual({
      id: 'l7',
      title: 'Upper body',
      detail: '18:00 · 50m · monthHive.summary.records {"count":1}',
      record: true,
    });
  });
});
