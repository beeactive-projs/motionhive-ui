import { describe, expect, it } from 'vitest';

import {
  CopyDayLock,
  CopyDaySummary,
  CopyExercise,
  CopyExerciseChange,
  CopyLastResult,
  ExerciseSetType,
  ProgramAssignmentStatus,
} from 'core';

import { shortDayLabel } from '../../workouts/workouts.config';
import {
  canEditCopy,
  canMoveTo,
  copyBadge,
  copyClientName,
  copyDayRow,
  copyHeader,
  copyWeeks,
  dayLockLabel,
  doneWeeksLine,
  insteadOfLine,
  lastResultView,
  lastSetsLine,
  markedChanged,
  openWeeks,
  programLine,
} from './client-copy.config';

function day(
  id: string,
  weekIndex: number,
  scheduledDate: string,
  lock: CopyDayLock | null,
): CopyDaySummary & { exerciseCount: number } {
  return {
    id,
    name: `Day ${id}`,
    notes: null,
    weekIndex,
    dayIndex: 0,
    scheduledDate,
    status: null,
    lock,
    editable: lock === null,
    changed: false,
    exerciseCount: 4,
  };
}

function exercise(over: Partial<CopyExercise> = {}): CopyExercise {
  return {
    id: 'ae-1',
    exerciseId: 'bench',
    masterExerciseId: 'pe-1',
    supersetGroupId: null,
    orderIndex: 0,
    notes: null,
    isModifiedFromMaster: false,
    exercise: { id: 'bench', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', level: 'BEGINNER', thumbnailUrl: null },
    sets: [],
    change: CopyExerciseChange.None,
    canRevert: false,
    program: {
      exerciseId: 'bench',
      exercise: { id: 'bench', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', level: 'BEGINNER', thumbnailUrl: null },
      notes: null,
      sets: [0, 1, 2].map((orderIndex) => ({
        orderIndex,
        setType: ExerciseSetType.Normal,
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetWeightKg: 60,
        targetWeightPercent1rm: null,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetRpe: null,
        targetRir: null,
        restAfterSeconds: 120,
        tempo: null,
        notes: null,
      })),
    },
    lastResult: null,
    ...over,
  };
}

describe("a client's copy", () => {
  it('names the client by first name, then last name, then the generic word', () => {
    const client = { id: 'c', firstName: 'Anna', lastName: 'Popescu', avatarUrl: null, handle: null };
    expect(copyClientName(client, 'Client')).toBe('Anna');
    expect(copyClientName({ ...client, firstName: ' ' }, 'Client')).toBe('Popescu');
    expect(copyClientName(null, 'Client')).toBe('Client');
  });

  it('says whose copy it is and that the program stays as it is', () => {
    expect(copyHeader('Anna', 'Strength Base')).toEqual({
      title: "Anna's copy",
      banner: 'Changes reach only Anna. Strength Base stays as it is.',
    });
  });

  it('is editable while the plan runs or is paused', () => {
    expect(canEditCopy(ProgramAssignmentStatus.Active)).toBe(true);
    expect(canEditCopy(ProgramAssignmentStatus.Paused)).toBe(true);
    expect(canEditCopy(ProgramAssignmentStatus.Pending)).toBe(false);
    expect(canEditCopy(ProgramAssignmentStatus.Completed)).toBe(false);
    expect(canEditCopy(ProgramAssignmentStatus.Cancelled)).toBe(false);
  });

  describe('weeks', () => {
    const days = [
      day('c', 2, '2026-11-25', null),
      day('a', 0, '2026-11-09', CopyDayLock.Done),
      day('b', 1, '2026-11-16', CopyDayLock.Skipped),
      day('d', 2, '2026-11-23', CopyDayLock.Done),
    ];

    it('groups the days by week, in date order, and finds the done weeks', () => {
      const weeks = copyWeeks(days);
      expect(weeks.map((week) => [week.weekIndex, week.locked, week.days.map((d) => d.id)])).toEqual([
        [0, true, ['a']],
        [1, true, ['b']],
        [2, false, ['d', 'c']],
      ]);
      expect(openWeeks(weeks).map((week) => week.weekIndex)).toEqual([2]);
    });

    it('folds the done weeks into one line', () => {
      expect(doneWeeksLine(copyWeeks(days))).toBe(
        "Weeks 1 and 2 are done. You see them in Training, but can't change them.",
      );
      expect(doneWeeksLine(copyWeeks(days.slice(0, 2)))).toBe(
        "Week 1 is done. You see it in Training, but can't change it.",
      );
      const locked = [...days, day('e', 3, '2026-11-30', null)].map((d) => ({
        ...d,
        lock: CopyDayLock.Past,
        editable: false,
      }));
      const four: (CopyDaySummary & { exerciseCount: number })[] = [...locked, day('f', 4, '2026-12-07', null)];
      expect(doneWeeksLine(copyWeeks(four))).toBe(
        "Weeks 1 to 4 are done. You see them in Training, but can't change them.",
      );
      expect(doneWeeksLine(copyWeeks([day('x', 0, '2026-11-23', null)]))).toBe('');
    });

    it('labels a locked day, and draws an open one with the plan tile', () => {
      expect(dayLockLabel(CopyDayLock.Done)).toBe('Done');
      expect(dayLockLabel(CopyDayLock.Started)).toBe('Started');
      expect(dayLockLabel(null)).toBeNull();
      const open = copyDayRow(day('c', 2, '2026-11-25', null));
      expect(open).toEqual(
        expect.objectContaining({ editable: true, lockLabel: null, icon: 'barbell-outline', color: 'primary' }),
      );
      expect(open.line).toBe(`${shortDayLabel('2026-11-25')} · 4 exercises`);
      expect(copyDayRow(day('a', 0, '2026-11-09', CopyDayLock.Done))).toEqual(
        expect.objectContaining({ editable: false, lockLabel: 'Done', icon: 'checkmark-circle' }),
      );
    });
  });

  describe("an exercise's label", () => {
    it('says Changed, Replaced or Added, and nothing as assigned', () => {
      expect(copyBadge(CopyExerciseChange.Changed, 'Anna')).toBe('Changed for Anna');
      expect(copyBadge(CopyExerciseChange.Replaced, 'Anna')).toBe('Replaced');
      expect(copyBadge(CopyExerciseChange.Added, 'Anna')).toBe('Added for Anna');
      expect(copyBadge(CopyExerciseChange.None, 'Anna')).toBeNull();
    });

    it('names what a replaced exercise stands in for', () => {
      const replaced = exercise({ exerciseId: 'db-press', change: CopyExerciseChange.Replaced });
      expect(insteadOfLine(replaced)).toBe('Instead of Bench press');
      expect(insteadOfLine(exercise({ change: CopyExerciseChange.Changed }))).toBeNull();
    });

    it("says the program's values under a changed exercise only", () => {
      expect(programLine(exercise({ change: CopyExerciseChange.Changed }))).toBe(
        'In the program: 3 sets · 8–10 reps · 60 kg',
      );
      expect(programLine(exercise())).toBeNull();
      expect(programLine(exercise({ change: CopyExerciseChange.Added, program: null }))).toBeNull();
    });

    it('is marked at once after a save changed it', () => {
      expect(markedChanged(exercise())).toEqual(
        expect.objectContaining({ change: CopyExerciseChange.Changed, canRevert: true, isModifiedFromMaster: true }),
      );
      expect(markedChanged(exercise({ exerciseId: 'db-press' })).change).toBe(CopyExerciseChange.Replaced);
      expect(markedChanged(exercise({ masterExerciseId: null, program: null }))).toEqual(
        expect.objectContaining({ change: CopyExerciseChange.Added, canRevert: false }),
      );
    });
  });

  describe('the last result', () => {
    const result: CopyLastResult = {
      workoutLogId: 'l-1',
      performedAt: '2026-11-09T09:00:00.000Z',
      averageRpe: 8.5,
      sets: [8, 8, 7].map((reps) => ({
        setType: ExerciseSetType.Normal,
        reps,
        weightKg: 57.5,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
      })),
    };

    it('says one weight once, then the reps of each set, and the average effort', () => {
      expect(lastResultView(result)).toEqual({
        when: `Last time · ${shortDayLabel(result.performedAt)}`,
        sets: '57.5 kg × 8 · 8 · 7',
        effort: 'Average effort 8.5 of 10',
      });
    });

    it('says each set when the weight changes, and leaves the effort out when none was logged', () => {
      const pyramid = { ...result, averageRpe: null, sets: [result.sets[0], { ...result.sets[1], weightKg: 60 }] };
      const view = lastResultView(pyramid);
      expect(view?.sets).toBe('57.5 kg × 8 · 60 kg × 8');
      expect(view?.effort).toBeNull();
    });

    it('says a hold by its time and leaves warm-ups out', () => {
      expect(
        lastSetsLine([
          { setType: ExerciseSetType.Warmup, reps: 10, weightKg: 20, durationSeconds: null, distanceMeters: null, rpe: null },
          { setType: ExerciseSetType.Normal, reps: null, weightKg: null, durationSeconds: 45, distanceMeters: null, rpe: null },
        ]),
      ).toBe('0:45');
    });

    it('shows nothing when there is none', () => {
      expect(lastResultView(null)).toBeNull();
      expect(lastResultView({ ...result, sets: [] })).toBeNull();
    });
  });

  it('moves a day only to a free date inside the plan, from today', () => {
    const bounds = { from: '2026-11-20', to: '2026-12-25', taken: ['2026-11-25'] };
    expect(canMoveTo('2026-11-26', bounds)).toBe(true);
    expect(canMoveTo('2026-11-19', bounds)).toBe(false);
    expect(canMoveTo('2026-12-26', bounds)).toBe(false);
    expect(canMoveTo('2026-11-25', bounds)).toBe(false);
    expect(canMoveTo('2027-03-01', { ...bounds, to: null })).toBe(true);
  });
});
