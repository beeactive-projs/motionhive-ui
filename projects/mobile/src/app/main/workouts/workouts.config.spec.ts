/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { WorkoutLogStatus } from 'core';

import { SpineTones } from '../../_shared/models/spine-tone.model';
import {
  WORKOUT_ICONS,
  assignedDayTone,
  clockDigitsToDisplay,
  clockDigitsToSeconds,
  dateRail,
  elapsedLabel,
  exerciseSetSummary,
  logChip,
  logTone,
  planPositionLabel,
  routineTone,
  secondsToClock,
  workoutDuration,
  workoutMetaLine,
  workoutTiles,
} from './workouts.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Component sources too — action sheets name their glyphs in TypeScript. */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Icon names this feature renders: static `name="…"` attributes on
 * `ion-icon`, static `icon="…"` attributes on the shared components that
 * draw one (empty states, settings rows, hex tiles), plus the `icon: '…'`
 * literals that bound names (`[name]="item.icon"`) are fed from. Scanning
 * only the templates missed every icon an action sheet declares, which is
 * the same blank-box failure one layer further back.
 */
function iconNamesUsed(): Set<string> {
  const found = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/<ion-icon[^>]*\bname="([a-z-]+)"/g)) {
      found.add(match[1]);
    }
    for (const match of html.matchAll(/\sicon="([a-z-]+)"/g)) {
      found.add(match[1]);
    }
  }
  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/\bicon:\s*'([a-z][a-z-]*)'/g)) {
      found.add(match[1]);
    }
  }
  return found;
}

const kebab = (key: string) => key.replace(/([A-Z])/g, '-$1').toLowerCase();

/** Enough of a WorkoutLog to exercise the helpers. */
const log = (over: Record<string, unknown> = {}) =>
  ({
    id: 'l1',
    name: 'Push day',
    status: WorkoutLogStatus.Completed,
    startedAt: '2026-09-12T10:00:00Z',
    durationSeconds: 1860,
    feelingRating: null,
    exercises: [],
    ...over,
  }) as never;

const set = (over: Record<string, unknown> = {}) => ({
  id: 's',
  isCompleted: true,
  weightKg: null,
  reps: null,
  durationSeconds: null,
  distanceMeters: null,
  ...over,
});

describe('workouts config', () => {
  // An unregistered icon renders as a blank box with no error — which is how
  // the set tick, the single most-used control in the logger, shipped
  // invisible once. This is the guard.
  it('registers every icon it renders, from templates and from code', () => {
    const registered = new Set(Object.keys(WORKOUT_ICONS).map(kebab));
    for (const name of iconNamesUsed()) {
      expect(registered, `${name} is rendered but not registered`).toContain(name);
    }
  });

  it('rotates routine tones so a list never reads as one grey block', () => {
    expect(routineTone(0)).not.toBe(routineTone(1));
    // Stable per index, so a row keeps its colour across a re-render.
    expect(routineTone(0)).toBe(routineTone(5));
  });

  // Every tone a row can wear must be one the `.mh-session-row` skin paints;
  // an unknown name leaves the row with no spine at all.
  it('keys a logged workout to a spine the row skin knows', () => {
    const known = new Set(Object.values(SpineTones));
    expect(logTone(log())).toBe(SpineTones.Booked);
    expect(logTone(log({ status: WorkoutLogStatus.InProgress }))).toBe(SpineTones.Honey);
    expect(logTone(log({ status: WorkoutLogStatus.Skipped }))).toBe(SpineTones.Muted);
    for (const status of Object.values(WorkoutLogStatus)) {
      expect(known).toContain(logTone(log({ status })));
      expect(known).toContain(assignedDayTone({ status } as never));
    }
  });

  // Completed is what almost every row is; a chip on every row says nothing.
  it('chips only the log states that are exceptions', () => {
    expect(logChip(log())).toBeNull();
    expect(logChip(log({ status: WorkoutLogStatus.Skipped }))?.label).toBe('Skipped');
    expect(logChip(log({ status: WorkoutLogStatus.InProgress }))?.label).toBe('In progress');
  });

  it('names only the parts of the meta line it actually knows', () => {
    expect(workoutMetaLine(6, 55, 'Barbell')).toBe('6 exercises · ~55 min · Barbell');
    expect(workoutMetaLine(1, null)).toBe('1 exercise');
    expect(workoutMetaLine(null, null)).toBe('');
  });

  it('counts weeks and days from one, not zero', () => {
    expect(planPositionLabel('Strength block', 2, 1)).toBe('Strength block · Week 3 · Day 2');
    expect(planPositionLabel(null, 0, 0)).toBe('Week 1 · Day 1');
  });

  // A calendar day is read as local midnight: `new Date('2026-09-12')` would
  // read it as UTC and slip a day west of Greenwich.
  it('reads a calendar day for the date rail without slipping a day', () => {
    expect(dateRail('2026-09-12').day).toBe('12');
    // 2026-09-12 is a Saturday.
    expect(dateRail('2026-09-12').weekday).toMatch(/^Sat/);
  });

  // A hold is read as a clock, never as a count of seconds.
  it('shows a duration as a clock', () => {
    expect(secondsToClock(90)).toBe('1:30');
    expect(secondsToClock(45)).toBe('0:45');
    expect(secondsToClock(600)).toBe('10:00');
    expect(secondsToClock(0)).toBe('0:00');
  });

  // Keypad digits fill right to left, the way every timer input works —
  // typing 1,3,0 means a minute and a half, not a hundred and thirty seconds.
  it('reads keypad digits right to left into seconds', () => {
    expect(clockDigitsToSeconds('130')).toBe(90);
    expect(clockDigitsToSeconds('45')).toBe(45);
    expect(clockDigitsToSeconds('5')).toBe(5);
    expect(clockDigitsToSeconds('1000')).toBe(600);
    expect(clockDigitsToSeconds('')).toBeNull();
  });

  it('shows those digits back as the clock they are building', () => {
    expect(clockDigitsToDisplay('1')).toBe('0:01');
    expect(clockDigitsToDisplay('13')).toBe('0:13');
    expect(clockDigitsToDisplay('130')).toBe('1:30');
    expect(clockDigitsToDisplay('')).toBe('0:00');
  });

  // One formatter for a workout's length, delegating to core's.
  it('formats a workout length, and says nothing when there is none', () => {
    expect(workoutDuration(1860)).toBe('31m');
    expect(workoutDuration(3900)).toBe('1h 5m');
    expect(workoutDuration(null)).toBe('');
    expect(workoutDuration(0)).toBe('');
  });

  it('reads elapsed time off the start instant, never a tick count', () => {
    const started = new Date('2026-09-12T10:00:00Z');
    const now = started.getTime() + 74_000;
    expect(elapsedLabel(started.toISOString(), now)).toBe('1:14');
    // An hour in, minutes alone would be ambiguous.
    expect(elapsedLabel(started.toISOString(), started.getTime() + 3_900_000)).toBe('1:05');
    // A clock that has not moved is 0:00, never negative.
    expect(elapsedLabel(started.toISOString(), started.getTime() - 5_000)).toBe('0:00');
  });

  // Only what the session actually contained — never one composite number.
  // Shared by the trainee's summary and the coach's review, so this is the
  // one place the tile maths lives.
  it('tiles only the modalities a session contained', () => {
    const loaded = log({
      exercises: [
        { isSkipped: false, sets: [set({ weightKg: 80, reps: 8 }), set({ weightKg: 80, reps: 7 })] },
      ],
    });
    expect(workoutTiles(loaded).map((t) => t.label)).toEqual(['Sets', 'Volume']);
    expect(workoutTiles(loaded).find((t) => t.label === 'Volume')?.value).toBe('1200 kg');

    const bodyweight = log({
      exercises: [{ isSkipped: false, sets: [set({ reps: 12 }), set({ reps: 10 })] }],
    });
    expect(workoutTiles(bodyweight).map((t) => t.label)).toEqual(['Sets', 'Reps']);

    const hold = log({
      exercises: [{ isSkipped: false, sets: [set({ durationSeconds: 60 }), set({ isCompleted: false, durationSeconds: 60 })] }],
    });
    // Unticked sets do not count, so one minute, not two.
    expect(workoutTiles(hold)).toEqual([
      { label: 'Sets', value: '1' },
      { label: 'Time', value: '1 min' },
    ]);
  });

  // A skip is a decision; "0 of 4" would read as a failure.
  it('summarises an exercise as done-of-total, and a skip as a skip', () => {
    expect(exerciseSetSummary({ isSkipped: false, sets: [set(), set({ isCompleted: false })] } as never)).toBe('1 of 2 sets');
    expect(exerciseSetSummary({ isSkipped: false, sets: [set()] } as never)).toBe('1 of 1 set');
    expect(exerciseSetSummary({ isSkipped: true, sets: [set()] } as never)).toBe('Skipped');
  });
});
