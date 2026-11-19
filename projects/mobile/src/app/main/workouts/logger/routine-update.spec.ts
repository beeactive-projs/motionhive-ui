import { describe, expect, it } from 'vitest';

import {
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  PrescribedSet,
  Routine,
  RoutineExercise,
  RoutineSources,
  WorkoutLog,
} from 'core';

import {
  changeSummary,
  isOwnRoutine,
  routineChanges,
  routineFromWorkout,
  updatableRoutineId,
} from './routine-update';

// ─── Builders ─────────────────────────────────────────────────────────────

function planned(id: string, exerciseId: string, name: string, sets = 3): RoutineExercise {
  return {
    id,
    exerciseId,
    orderIndex: 0,
    supersetGroupId: null,
    notes: null,
    defaultSets: sets,
    targetRepsMin: 8,
    targetRepsMax: 8,
    targetWeightKg: 60,
    restAfterSeconds: 90,
    sets: Array.from({ length: sets }, () => ({
      setType: ExerciseSetType.Normal,
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetWeightKg: 60,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      restAfterSeconds: 90,
    })),
    hasVariedSets: false,
    exercise: { id: exerciseId, name, slug: exerciseId, kind: 'STRENGTH', thumbnailUrl: null },
  };
}

function routine(exercises: RoutineExercise[]): Routine {
  return {
    id: 'r-1',
    ownerId: 'me',
    source: RoutineSources.User,
    name: 'Leg day',
    notes: null,
    folder: null,
    lastPerformedAt: null,
    level: null,
    defaultRestSeconds: null,
    archived: false,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    exerciseCount: exercises.length,
    exercises: exercises.map((e, orderIndex) => ({ ...e, orderIndex })),
  };
}

/** A set the routine planned, as a logged set carries its link. */
function plan(partial: Partial<PrescribedSet> = {}): PrescribedSet {
  return {
    id: 'ps',
    prescribedExerciseId: 'pe',
    orderIndex: 0,
    setType: ExerciseSetType.Normal,
    targetRepsMin: 8,
    targetRepsMax: 8,
    targetWeightKg: 60,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: null,
    targetRir: null,
    restAfterSeconds: 90,
    tempo: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function logged(partial: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: 'ls',
    loggedExerciseId: 'le',
    assignedSetId: null,
    orderIndex: 0,
    setType: ExerciseSetType.Normal,
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    rir: null,
    restAfterSeconds: null,
    isCompleted: true,
    completedAt: null,
    notes: null,
    prescribedSet: null,
    ...partial,
  };
}

/** A workout exercise done for routine exercise `link` (null when added), with `sets`. */
function done(
  exerciseId: string,
  name: string,
  link: string | null,
  sets: LoggedSet[] = [logged({ prescribedSet: plan() }), logged({ prescribedSet: plan() }), logged({ prescribedSet: plan() })],
  partial: Partial<LoggedExercise> = {},
): LoggedExercise {
  return {
    id: `le-${exerciseId}`,
    workoutLogId: 'log',
    exerciseId,
    assignedExerciseId: null,
    orderIndex: 0,
    exerciseNameSnapshot: name,
    exerciseThumbnailUrlSnapshot: null,
    supersetGroupId: null,
    notes: null,
    isSkipped: false,
    swappedFromExerciseId: null,
    prescribedExercise: link ? { id: link, notes: null } : null,
    sets,
    ...partial,
  };
}

const legDay = () =>
  routine([planned('pe-squat', 'squat', 'Back squat'), planned('pe-curl', 'curl', 'Leg curl')]);

const asPlanned = () => [done('squat', 'Back squat', 'pe-squat'), done('curl', 'Leg curl', 'pe-curl')];

// ─── Which workouts ask ───────────────────────────────────────────────────

describe('which workouts can update a routine', () => {
  const log = (partial: Partial<WorkoutLog>) => partial as WorkoutLog;

  it('is a workout started from a routine', () => {
    expect(
      updatableRoutineId(
        log({ sourceProgramId: 'r-1', sourceProgram: { id: 'r-1', name: 'Leg day', isSingleWorkout: true } }),
      ),
    ).toBe('r-1');
  });

  it('is not a coach’s plan day, a multi-week program or a freestyle workout', () => {
    const program = { id: 'p', name: 'Block', isSingleWorkout: false };
    expect(updatableRoutineId(log({ assignedWorkoutId: 'aw', sourceProgramId: 'r-1' }))).toBeNull();
    expect(updatableRoutineId(log({ sourceProgramId: 'p', sourceProgram: program }))).toBeNull();
    expect(updatableRoutineId(log({ sourceProgramId: null }))).toBeNull();
    // Not known to be a routine: never guess, the update would rewrite a program's first day.
    expect(updatableRoutineId(log({ sourceProgramId: 'r-1' }))).toBeNull();
  });

  it('is yours: never a starter, never someone else’s', () => {
    expect(isOwnRoutine(legDay(), 'me')).toBe(true);
    expect(isOwnRoutine(legDay(), 'you')).toBe(false);
    expect(isOwnRoutine({ ...legDay(), source: RoutineSources.System }, 'me')).toBe(false);
    expect(isOwnRoutine(legDay(), null)).toBe(false);
  });
});

// ─── What counts as a change ──────────────────────────────────────────────

describe('routineChanges', () => {
  it('finds nothing in a workout done as planned', () => {
    expect(routineChanges(legDay(), asPlanned())).toBeNull();
  });

  // Lifting more is the point of a workout, and a skip is about today.
  it('ignores heavier numbers and a skipped exercise', () => {
    const heavier = [
      done('squat', 'Back squat', 'pe-squat', [
        logged({ weightKg: 80, reps: 10, prescribedSet: plan() }),
        logged({ weightKg: 80, reps: 10, prescribedSet: plan() }),
        logged({ weightKg: 80, reps: 10, prescribedSet: plan() }),
      ]),
      done('curl', 'Leg curl', 'pe-curl', [], { isSkipped: true }),
    ];

    expect(routineChanges(legDay(), heavier)).toBeNull();
  });

  it('knows a skipped exercise that came back without its link', () => {
    const changes = routineChanges(legDay(), [
      done('squat', 'Back squat', 'pe-squat'),
      done('curl', 'Leg curl', null, [], { isSkipped: true }),
    ]);

    expect(changes).toBeNull();
  });

  // Saving the routine mid-workout rewrites its exercises, and the database
  // clears every link the running workout held.
  it('pairs by movement when the routine was saved mid-workout', () => {
    const unlinked = [logged(), logged(), logged()];
    const changes = routineChanges(legDay(), [
      done('squat', 'Back squat', null, unlinked),
      done('curl', 'Leg curl', null, unlinked),
    ]);

    expect(changes).toBeNull();
  });

  it('still names a second one of a movement the routine has once', () => {
    const changes = routineChanges(legDay(), [
      done('squat', 'Back squat', 'pe-squat'),
      done('curl', 'Leg curl', 'pe-curl'),
      done('squat', 'Back squat', null, [logged()]),
    ]);

    expect(changes).toMatchObject({ added: ['Back squat'], removed: [] });
  });

  it('names what was added and what was taken out', () => {
    const changes = routineChanges(legDay(), [
      done('squat', 'Back squat', 'pe-squat'),
      done('lunge', 'Walking lunge', null, [logged()]),
    ]);

    expect(changes).toMatchObject({ added: ['Walking lunge'], removed: ['Leg curl'], reordered: false });
  });

  it('names a swap, linked or only naming what it replaced', () => {
    const linked = routineChanges(legDay(), [
      done('legpress', 'Leg press', 'pe-squat'),
      done('curl', 'Leg curl', 'pe-curl'),
    ]);
    const unlinked = routineChanges(legDay(), [
      done('legpress', 'Leg press', null, undefined, { swappedFromExerciseId: 'squat' }),
      done('curl', 'Leg curl', 'pe-curl'),
    ]);

    expect(linked).toMatchObject({ swapped: ['Leg press'], added: [], removed: [] });
    expect(unlinked).toMatchObject({ swapped: ['Leg press'], added: [], removed: [] });
  });

  it('names an exercise done with a different number of sets', () => {
    const changes = routineChanges(legDay(), [
      done('squat', 'Back squat', 'pe-squat', [
        logged({ prescribedSet: plan() }),
        logged({ prescribedSet: plan() }),
        logged({ prescribedSet: plan() }),
        logged(),
      ]),
      done('curl', 'Leg curl', 'pe-curl'),
    ]);

    expect(changes).toMatchObject({ sets: ['Back squat'] });
  });

  it('sees a new order', () => {
    const changes = routineChanges(legDay(), [...asPlanned()].reverse());

    expect(changes).toMatchObject({ reordered: true, added: [], removed: [] });
  });

  it('sees two exercises done as a superset', () => {
    const [squat, curl] = asPlanned();
    const changes = routineChanges(legDay(), [
      { ...squat, supersetGroupId: 1 },
      { ...curl, supersetGroupId: 1 },
    ]);

    expect(changes).toMatchObject({ supersets: true });
  });
});

describe('changeSummary', () => {
  it('says each kind of change in a sentence of its own', () => {
    const summary = changeSummary({
      added: ['Walking lunge'],
      removed: ['Leg curl'],
      swapped: [],
      sets: ['Back squat'],
      reordered: true,
      supersets: false,
    });

    expect(summary).toBe(
      'You added Walking lunge. You removed Leg curl. You changed the sets of Back squat. ' +
        'You changed the order of the exercises.',
    );
  });

  it('lists a few names, and counts the rest', () => {
    const summary = changeSummary({
      added: ['A', 'B', 'C', 'D', 'E'],
      removed: [],
      swapped: [],
      sets: [],
      reordered: false,
      supersets: false,
    });

    expect(summary).toBe('You added A, B and 3 more.');
  });
});

// ─── What the update writes ───────────────────────────────────────────────

describe('routineFromWorkout', () => {
  // User decision, 2026-11-16: the new shape keeps the routine's targets.
  it('keeps the routine’s targets on its own sets, whatever was lifted', () => {
    const [squat] = routineFromWorkout(legDay(), [
      done('squat', 'Back squat', 'pe-squat', [
        logged({ weightKg: 100, reps: 5, prescribedSet: plan({ targetWeightKg: '60.00' as unknown as number }) }),
      ]),
    ]);

    expect(squat.sets).toEqual([
      { setType: ExerciseSetType.Normal, targetRepsMin: 8, targetRepsMax: 8, targetWeightKg: 60, restAfterSeconds: 90 },
    ]);
  });

  it('plans a set the workout added from what was logged, resting as its exercise does', () => {
    const [squat] = routineFromWorkout(legDay(), [
      done('squat', 'Back squat', 'pe-squat', [
        logged({ prescribedSet: plan() }),
        logged({ setType: ExerciseSetType.Dropset, weightKg: 40, reps: 12 }),
      ]),
    ]);

    expect(squat.sets?.[1]).toEqual({
      setType: ExerciseSetType.Dropset,
      targetRepsMin: 12,
      targetRepsMax: 12,
      targetWeightKg: 40,
      restAfterSeconds: 90,
    });
  });

  it('plans an added or swapped-in exercise from what was logged', () => {
    const rows = routineFromWorkout(legDay(), [
      done('legpress', 'Leg press', 'pe-squat', [logged({ weightKg: 120, reps: 10, prescribedSet: plan() })]),
      done('plank', 'Plank', null, [logged({ durationSeconds: 60 })]),
    ]);

    expect(rows).toEqual([
      {
        exerciseId: 'legpress',
        sets: [{ setType: ExerciseSetType.Normal, targetRepsMin: 10, targetRepsMax: 10, targetWeightKg: 120 }],
      },
      { exerciseId: 'plank', sets: [{ setType: ExerciseSetType.Normal, targetDurationSeconds: 60 }] },
    ]);
  });

  it('keeps a skipped exercise as the routine had it, where it stood', () => {
    const rows = routineFromWorkout(legDay(), [
      done('curl', 'Leg curl', 'pe-curl', [], { isSkipped: true }),
      done('squat', 'Back squat', 'pe-squat'),
    ]);

    expect(rows.map((row) => row.exerciseId)).toEqual(['curl', 'squat']);
    expect(rows[0].sets).toHaveLength(3);
  });

  it('keeps a skipped exercise that came back without its link', () => {
    const rows = routineFromWorkout(legDay(), [
      done('squat', 'Back squat', 'pe-squat'),
      done('curl', 'Leg curl', null, [], { isSkipped: true }),
    ]);

    expect(rows.map((row) => row.exerciseId)).toEqual(['squat', 'curl']);
    expect(rows[1].sets).toHaveLength(3);
  });

  it('keeps the routine’s sets by position when its links were cleared', () => {
    const ranged = routine([
      {
        ...planned('pe-squat', 'squat', 'Back squat', 2),
        sets: planned('pe-squat', 'squat', 'Back squat', 2).sets.map((set) => ({
          ...set,
          targetRepsMin: 8,
          targetRepsMax: 12,
        })),
      },
    ]);

    const [squat] = routineFromWorkout(ranged, [
      done('squat', 'Back squat', null, [
        logged({ weightKg: 70, reps: 10 }),
        logged({ weightKg: 70, reps: 10 }),
        logged({ weightKg: 50, reps: 15 }),
      ]),
    ]);

    expect(squat.sets).toEqual([
      { setType: ExerciseSetType.Normal, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 60, restAfterSeconds: 90 },
      { setType: ExerciseSetType.Normal, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 60, restAfterSeconds: 90 },
      { setType: ExerciseSetType.Normal, targetRepsMin: 15, targetRepsMax: 15, targetWeightKg: 50, restAfterSeconds: 90 },
    ]);
  });

  it('leaves out what the workout took out, and a movement no longer in the catalog', () => {
    const rows = routineFromWorkout(legDay(), [
      done('squat', 'Back squat', 'pe-squat'),
      { ...done('gone', 'Gone', null, [logged()]), exerciseId: null },
    ]);

    expect(rows.map((row) => row.exerciseId)).toEqual(['squat']);
  });

  it('keeps the routine’s note on an exercise, and the workout’s supersets', () => {
    const withNote = routine([
      { ...planned('pe-squat', 'squat', 'Back squat'), notes: 'Belt on' },
      planned('pe-curl', 'curl', 'Leg curl'),
    ]);
    const [squat, curl] = asPlanned();

    const rows = routineFromWorkout(withNote, [
      { ...squat, supersetGroupId: 5 },
      { ...curl, supersetGroupId: 5 },
    ]);

    expect(rows[0]).toMatchObject({ notes: 'Belt on', supersetGroupId: 1 });
    expect(rows[1]).toMatchObject({ supersetGroupId: 1 });
  });
});
