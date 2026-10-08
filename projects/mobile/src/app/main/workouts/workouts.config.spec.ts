/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { OneRepMaxSource, ProgramAssignmentKind, WorkoutLogStatus } from 'core';

import { SpineTones } from '../../_shared/models/spine-tone.model';
import {
  CalendarDayStates,
  HeroStates,
  LogSources,
  WORKOUT_ICONS,
  assignedDayTone,
  bestTopSet,
  calendarCells,
  calendarDayState,
  calendarWeek,
  clockDigitsToDisplay,
  clockDigitsToSeconds,
  compactPrescription,
  dateRail,
  heroState,
  elapsedLabel,
  exerciseSessionLine,
  exerciseDoneSummary,
  exerciseSetSummary,
  isExerciseDone,
  lastTimeSummary,
  setPlaceholder,
  inRange,
  lastDoneLabel,
  logChip,
  logMeta,
  logSource,
  logTone,
  monthDoneCount,
  oneRepMaxDelta,
  oneRepMaxPoints,
  planPositionLabel,
  planWeekLabel,
  prescriptionLine,
  recordSessionIds,
  routineTileColor,
  secondsToClock,
  trendGeometry,
  workoutDuration,
  workoutMetaLine,
  workoutTiles,
} from './workouts.config';
import { workoutRoutes } from './workouts.routes';

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

  it('rotates routine tiles so a list never reads as one grey block', () => {
    expect(routineTileColor(0)).not.toBe(routineTileColor(1));
    // Stable per index, so a row keeps its colour across a re-render.
    expect(routineTileColor(0)).toBe(routineTileColor(4));
  });

  it('says when a routine was last done in the fewest words', () => {
    const now = new Date(2026, 9, 8, 18, 0);
    const at = (y: number, m: number, d: number) => new Date(y, m, d, 9, 30).toISOString();
    expect(lastDoneLabel(at(2026, 9, 8), now)).toBe('last done today');
    expect(lastDoneLabel(at(2026, 9, 7), now)).toBe('last done yesterday');
    // Within the week: the weekday. 6 October 2026 is a Tuesday.
    expect(lastDoneLabel(at(2026, 9, 6), now)).toBe('last done Tuesday');
    // Older: the date, with the year only once it is not this one.
    expect(lastDoneLabel(at(2026, 7, 30), now)).toBe('last done 30 Aug');
    expect(lastDoneLabel(at(2025, 11, 30), now)).toBe('last done 30 Dec 2025');
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

  // Only a coach's assignment is named; everything you started yourself is
  // the silent default. An API that predates the kind only ever sent coach
  // assignments.
  it('names a logged workout coach-sourced only when a coach assigned it', () => {
    const assignment = (over: Record<string, unknown> = {}) => ({
      id: 'a1',
      programNameSnapshot: 'Strength block',
      masterProgramId: null,
      ...over,
    });
    expect(logSource(log())).toBe(LogSources.Self);
    expect(logSource(log({ assignment: null }))).toBe(LogSources.Self);
    expect(logSource(log({ assignment: assignment() }))).toBe(LogSources.Coach);
    expect(
      logSource(log({ assignment: assignment({ assignmentKind: ProgramAssignmentKind.Self }) })),
    ).toBe(LogSources.Self);
    expect(
      logSource(log({ assignment: assignment({ assignmentKind: ProgramAssignmentKind.Coach }) })),
    ).toBe(LogSources.Coach);
  });

  // Duration, then how many sets were ticked, then how it felt. Unticked
  // sets are not work done, and a session with none says nothing about sets.
  it('reads a logged workout as duration · completed sets · feeling', () => {
    const exercises = [
      { sets: [set(), set(), set({ isCompleted: false })] },
      { sets: [set()] },
    ];
    expect(logMeta(log({ exercises, feelingRating: 5 }))).toBe('31m · 3 sets · felt 5/5');
    expect(logMeta(log({ exercises: [{ sets: [set()] }] }))).toBe('31m · 1 set');
    expect(logMeta(log({ exercises: [{ sets: [set({ isCompleted: false })] }] }))).toBe('31m');
    expect(logMeta(log({ exercises: undefined, durationSeconds: null }))).toBe('');
  });

  // The calendar shows the most meaningful thing a day held: finished beats
  // skipped, a coach's plan beats your own, and an open log is not history.
  it('fills a calendar day by what mattered most on it', () => {
    const coach = { id: 'a1', programNameSnapshot: 'Block', masterProgramId: null };
    const skipped = log({ status: WorkoutLogStatus.Skipped });
    expect(calendarDayState([log({ assignment: coach }), skipped], false)).toBe(CalendarDayStates.Coach);
    expect(calendarDayState([log(), log({ assignment: coach })], false)).toBe(CalendarDayStates.Coach);
    expect(calendarDayState([log(), skipped], false)).toBe(CalendarDayStates.Self);
    expect(calendarDayState([skipped], false)).toBe(CalendarDayStates.Skipped);
    expect(calendarDayState([log({ status: WorkoutLogStatus.InProgress })], false)).toBe(
      CalendarDayStates.None,
    );
    expect(calendarDayState([], false)).toBe(CalendarDayStates.None);
    expect(calendarDayState([], true)).toBe(CalendarDayStates.Future);
  });

  // Six fixed rows, Monday first, so the page never jumps between months.
  // September 2024 starts on a Sunday: six days of August lead it.
  it('lays a month out as 42 Monday-first cells', () => {
    const today = new Date(2024, 8, 12);
    const cells = calendarCells(new Date(2024, 8, 20), [], today);
    expect(cells).toHaveLength(42);
    expect(cells[5]).toMatchObject({ key: '2024-08-31', inMonth: false });
    expect(cells[6]).toMatchObject({ key: '2024-09-01', day: 1, inMonth: true });
    expect(cells.find((cell) => cell.isToday)?.key).toBe('2024-09-12');
    expect(cells.find((cell) => cell.key === '2024-09-13')?.state).toBe(CalendarDayStates.Future);
    expect(cells.find((cell) => cell.key === '2024-09-11')?.state).toBe(CalendarDayStates.None);
  });

  // A late-evening workout belongs to the day it was done on locally, not to
  // whatever day it already is in UTC.
  it('puts a logged workout on its local day, newest first', () => {
    const late = log({ id: 'late', startedAt: new Date(2024, 8, 10, 23, 30).toISOString() });
    const early = log({ id: 'early', startedAt: new Date(2024, 8, 10, 7, 0).toISOString() });
    const cells = calendarCells(new Date(2024, 8, 1), [early, late], new Date(2024, 8, 12));
    const tenth = cells.find((cell) => cell.key === '2024-09-10');
    expect(tenth).toMatchObject({ state: CalendarDayStates.Self, logIds: ['late', 'early'] });
    expect(cells.find((cell) => cell.key === '2024-09-11')?.logIds).toEqual([]);
  });

  // The neighbouring months' days are context only: they never open anything.
  it('keeps spill-over days inert even when something was logged on them', () => {
    const august = log({ startedAt: new Date(2024, 7, 31, 10).toISOString() });
    const cells = calendarCells(new Date(2024, 8, 1), [august], new Date(2024, 8, 12));
    expect(cells[5]).toMatchObject({ inMonth: false, state: CalendarDayStates.None, logIds: [] });
  });

  it('counts only finished workouts in the month shown as done', () => {
    const logs = [
      log({ startedAt: new Date(2024, 8, 2, 9).toISOString() }),
      log({ startedAt: new Date(2024, 8, 3, 9).toISOString(), status: WorkoutLogStatus.Skipped }),
      log({ startedAt: new Date(2024, 7, 30, 9).toISOString() }),
    ];
    expect(monthDoneCount(logs, new Date(2024, 8, 1))).toBe(1);
  });

  // A folded calendar keeps the week you care about: today's or the tapped
  // day's, and the first week when neither is in the month shown.
  it('folds a month down to the week holding the focus day', () => {
    const cells = calendarCells(new Date(2024, 8, 1), [], new Date(2024, 8, 12));
    expect(calendarWeek(cells, '2024-09-12').map((cell) => cell.day)).toEqual([9, 10, 11, 12, 13, 14, 15]);
    expect(calendarWeek(cells, null).map((cell) => cell.key)).toEqual(cells.slice(0, 7).map((c) => c.key));
    // A spill-over day is not this month's week.
    expect(calendarWeek(cells, '2024-08-31')).toEqual(cells.slice(0, 7));
  });

  // A range counts back whole local days and includes its first one, whether
  // the item carries a calendar day or a full instant.
  it('keeps items from the first day of a range onwards', () => {
    const now = new Date(2026, 8, 30, 15).getTime();
    const at = (item: string) => item;
    expect(inRange(['2026-09-02', '2026-09-01'], at, '4w', now)).toEqual(['2026-09-02']);
    const justInside = new Date(2026, 8, 2, 0, 30).toISOString();
    const justOutside = new Date(2026, 8, 1, 23, 30).toISOString();
    expect(inRange([justInside, justOutside], at, '4w', now)).toEqual([justInside]);
  });

  // The 1RM series is a staircase of records: the best carried in from
  // before the range is where the range starts, and a lone first record has
  // nothing to measure from.
  it('measures the 1RM change from the best held when the range opened', () => {
    const now = new Date(2026, 8, 30, 15).getTime();
    const point = (weightKg: number, when: Date, source: string = OneRepMaxSource.EstimatedEpley) => ({
      weightKg,
      recordedAt: when.toISOString(),
      source,
    });
    expect(oneRepMaxDelta([], '12w', now)).toBeNull();
    expect(oneRepMaxDelta([point(80, new Date(2026, 8, 20))], '4w', now)).toBeNull();

    const series = [point(80, new Date(2026, 7, 1)), point(84, new Date(2026, 8, 20))];
    expect(oneRepMaxDelta(series, '4w', now)).toBe(4);
    const points = oneRepMaxPoints(series, '4w', now);
    expect(points.map((p) => p.y)).toEqual([80, 84, 84]);
    expect(points[points.length - 1].x).toBe(now);

    // A quiet range reads flat, not missing.
    expect(oneRepMaxDelta([point(80, new Date(2026, 7, 1))], '4w', now)).toBe(0);
    // A retest can come in lower.
    const lower = [point(90, new Date(2026, 8, 5), OneRepMaxSource.Tested), point(85, new Date(2026, 8, 20), OneRepMaxSource.Manual)];
    expect(oneRepMaxDelta(lower, '12w', now)).toBe(-5);
  });

  // Ranked by estimated 1RM, not by weight: five reps at 72.5 is the better
  // set than two at 75.
  it('picks the best top set by estimated 1RM', () => {
    const session = (topWeightKg: number | null, topReps: number | null) =>
      ({ workoutLogId: 's', performedAt: '', workoutName: '', setCount: 3, topWeightKg, topReps, bestDurationSeconds: null, bestDistanceMeters: null });
    expect(bestTopSet([session(75, 2), session(72.5, 5), session(null, 12)])).toEqual({ weightKg: 72.5, reps: 5 });
    expect(bestTopSet([session(null, 10)])).toBeNull();
  });

  // Only an estimate is something a session did; a tested or typed-in 1RM
  // is not a record of that day's training.
  it('marks the sessions that set an estimated record, by local day', () => {
    const progress = {
      exercise: { id: 'e', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', thumbnailUrl: null },
      oneRepMaxSeries: [
        { weightKg: 84, recordedAt: new Date(2026, 8, 10, 21).toISOString(), source: OneRepMaxSource.EstimatedEpley },
        { weightKg: 90, recordedAt: new Date(2026, 8, 5, 9).toISOString(), source: OneRepMaxSource.Tested },
      ],
      sessions: [
        { workoutLogId: 'a', performedAt: new Date(2026, 8, 10, 7).toISOString() },
        { workoutLogId: 'b', performedAt: new Date(2026, 8, 5, 9).toISOString() },
      ],
    } as never;
    expect([...recordSessionIds(progress)]).toEqual(['a']);
  });

  it('reads a session as its sets and the top set, or its best for a hold', () => {
    const session = {
      workoutLogId: 's', performedAt: '', workoutName: '', setCount: 3,
      topWeightKg: 72.5, topReps: 5, bestDurationSeconds: null, bestDistanceMeters: null,
    };
    expect(exerciseSessionLine(session)).toBe('3 sets · top 72.5 × 5');
    expect(exerciseSessionLine({ ...session, topWeightKg: null, topReps: null, bestDurationSeconds: 90 })).toBe('3 sets · best 1:30');
  });

  // The domain pads the data by one each way so the line never rides an
  // edge; a single point is a dot, no line.
  it('shapes a trend line in percent of its plot', () => {
    const shape = trendGeometry([{ x: 0, y: 80 }, { x: 100, y: 84 }], 0, 100);
    expect(shape?.ticks.map((tick) => tick.value)).toEqual([85, 82, 79]);
    expect(shape?.end).toEqual({ x: 100, y: 16.67 });
    expect(shape?.line.startsWith('M0 ')).toBe(true);
    expect(trendGeometry([{ x: 50, y: 80 }], 0, 100)?.line).toBe('');
    expect(trendGeometry([], 0, 100)).toBeNull();
  });

  // A parameterised path listed before a literal one swallows it.
  it('routes an exercise progress page without shadowing Progress', () => {
    const paths = workoutRoutes.map((route) => route.path);
    const progress = paths.indexOf('progress');
    const exercise = paths.indexOf('progress/:exerciseId');
    expect(progress).toBeGreaterThan(-1);
    expect(exercise).toBeGreaterThan(progress);
    expect(exercise).toBeLessThan(paths.indexOf('routine/:id'));
  });

  it('names only the parts of the meta line it actually knows', () => {
    expect(workoutMetaLine(6, 55, 'Barbell')).toBe('6 exercises · ~55 min · Barbell');
    expect(workoutMetaLine(1, null)).toBe('1 exercise');
    expect(workoutMetaLine(null, null)).toBe('');
  });

  it('folds an exercise once every set is ticked, with its volume', () => {
    const set = (done: boolean, weightKg: number | null, reps: number | null) =>
      ({ isCompleted: done, weightKg, reps, durationSeconds: null }) as never;
    const done = { isSkipped: false, sets: [set(true, 100, 10), set(true, 100, 8), set(true, 120, 2)] };
    expect(isExerciseDone(done as never)).toBe(true);
    expect(isExerciseDone({ ...done, sets: [set(true, 100, 10), set(false, null, null)] } as never)).toBe(false);
    expect(isExerciseDone({ isSkipped: false, sets: [] } as never)).toBe(false);
    expect(exerciseDoneSummary(done as never)).toBe('3 sets done · 2,040 kg');
    expect(lastTimeSummary([set(true, 80, 8), set(true, 80, 8), set(true, 75, 7)])).toBe('80 kg · 8 · 8 · 7');
    expect(lastTimeSummary([])).toBe('');
  });

  it('shows the target as a placeholder, then last time', () => {
    const empty = { assignedSet: null } as never;
    const planned = {
      assignedSet: { targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: null, resolvedWeightKg: 82.5 },
    } as never;
    const previous = { weightKg: 80, reps: 8 } as never;
    expect(setPlaceholder(planned, 'reps', null)).toBe('6–8');
    expect(setPlaceholder(planned, 'weight', previous)).toBe('82.5');
    expect(setPlaceholder(empty, 'weight', previous)).toBe('80');
    expect(setPlaceholder(empty, 'reps', null)).toBe('');
  });

  it('describes a prescription before Start', () => {
    const set = {
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetWeightKg: 70,
      targetDurationSeconds: null,
    };
    expect(prescriptionLine([set, set, set, set])).toBe('4 sets · 8 reps · 70 kg');
    expect(
      prescriptionLine([
        { ...set, targetRepsMin: 6, targetWeightKg: 80 },
        { ...set, targetWeightKg: 82.5 },
      ]),
    ).toBe('2 sets · 6–8 reps · 82.5 kg top set');
    expect(
      prescriptionLine([
        { ...set, targetWeightKg: null, targetWeightPercent1rm: 75 },
        { ...set, targetWeightKg: null, targetWeightPercent1rm: 80 },
      ]),
    ).toBe('2 sets · 8 reps · 80% 1RM');
    expect(
      prescriptionLine([
        { ...set, targetWeightKg: null, targetWeightPercent1rm: 75, resolvedWeightKg: 90 },
      ]),
    ).toBe('1 set · 8 reps · 90 kg');
    const hold = { targetRepsMin: null, targetRepsMax: null, targetWeightKg: null, targetDurationSeconds: 45 };
    expect(prescriptionLine([hold, hold, hold])).toBe('3 sets · 45 sec hold');
    expect(prescriptionLine([])).toBe('');
  });

  it('cuts a prescription down to the hero card column', () => {
    const set = {
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetWeightKg: 70,
      targetDurationSeconds: null,
    };
    expect(compactPrescription([set, set, set, set])).toBe('4 × 8 · 70 kg');
    expect(
      compactPrescription([
        { ...set, targetRepsMin: 6, targetWeightKg: 80 },
        { ...set, targetWeightKg: 82.5 },
      ]),
    ).toBe('2 × 6–8 · 82.5 kg');
    expect(
      compactPrescription([{ ...set, targetWeightKg: null, targetWeightPercent1rm: 75 }]),
    ).toBe('1 × 8 · 75% 1RM');
    const hold = { targetRepsMin: null, targetRepsMax: null, targetWeightKg: null, targetDurationSeconds: 45 };
    expect(compactPrescription([hold, hold, hold])).toBe('3 × 45 s');
    const bare = { targetRepsMin: null, targetRepsMax: null, targetWeightKg: null, targetDurationSeconds: null };
    expect(compactPrescription([bare, bare])).toBe('2 sets');
    expect(compactPrescription([])).toBe('');
  });

  it('lets a settled day outrank a session open elsewhere', () => {
    const day = (status: WorkoutLogStatus | null) =>
      ({ status }) as Parameters<typeof heroState>[0];
    expect(heroState(day(null), false)).toBe(HeroStates.Ready);
    expect(heroState(day(null), true)).toBe(HeroStates.Blocked);
    expect(heroState(day(WorkoutLogStatus.Completed), true)).toBe(HeroStates.Done);
    expect(heroState(day(WorkoutLogStatus.Skipped), true)).toBe(HeroStates.Skipped);
  });

  it('places a plan in its weeks, with a total only for a coach plan', () => {
    const plan = (over: Record<string, unknown> = {}) =>
      ({
        startDate: '2026-09-21',
        endDate: '2026-12-13',
        assignmentKind: ProgramAssignmentKind.Coach,
        ...over,
      }) as Parameters<typeof planWeekLabel>[0];
    // Day 17 of a 12-week block.
    expect(planWeekLabel(plan(), '2026-10-08')).toBe('Week 3 of 12');
    expect(planWeekLabel(plan(), '2026-09-21')).toBe('Week 1 of 12');
    // Past the end it holds at the last week rather than counting on.
    expect(planWeekLabel(plan(), '2027-01-10')).toBe('Week 12 of 12');
    expect(planWeekLabel(plan({ endDate: null }), '2026-10-08')).toBe('Week 3');
    expect(planWeekLabel(plan({ assignmentKind: ProgramAssignmentKind.Self }), '2026-10-08')).toBe(
      'Week 3',
    );
    expect(planWeekLabel(plan({ startDate: '2026-10-12' }), '2026-10-08')).toMatch(/^Starts /);
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
    // An hour in, the seconds stay: "1:05" would read as minutes and look frozen.
    expect(elapsedLabel(started.toISOString(), started.getTime() + 3_912_000)).toBe('1:05:12');
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
