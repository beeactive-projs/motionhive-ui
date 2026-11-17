import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Config, IonItemSliding, IonRouterOutlet, NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { NEVER, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuthStore,
  DEFAULT_WORKOUT_SETTINGS,
  ExerciseService,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineService,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { RestAlertService } from '../../../_shared/services/rest-alert.service';
import { ActiveSessionStore } from '../_services/active-session.store';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { LockScreenService } from '../_services/lock-screen.service';
import { RestCueService } from '../_services/rest-cue.service';
import { ScreenAwakeService } from '../_services/screen-awake.service';
import { StillTrainingService } from '../_services/still-training.service';
import { WorkoutSettingsStore } from '../_services/workout-settings.store';
import { FinishChoices } from '../workouts.config';
import { Logger } from './logger';
import { RoutineUpdateChoices } from './routine-update';

function set(id: string, partial: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id,
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
    isCompleted: false,
    completedAt: null,
    notes: null,
    ...partial,
  };
}

function exercise(id: string, sets: LoggedSet[], partial: Partial<LoggedExercise> = {}) {
  return {
    id,
    exerciseId: `cat-${id}`,
    exerciseNameSnapshot: id,
    isSkipped: false,
    sets,
    ...partial,
  } as LoggedExercise;
}

function workout(...exercises: LoggedExercise[]): WorkoutLog {
  return { id: 'wl-1', name: 'Push day', exercises } as unknown as WorkoutLog;
}

let destroy: (() => void) | null = null;
afterEach(() => {
  // Stops the page's clock.
  destroy?.();
  destroy = null;
});

/**
 * The logger on `log`, its template blanked (Ionic does not render in
 * jsdom), with the services it reaches stubbed. Its effects never run: no
 * change detection, so the clock, the lock screen and the scroll stay out.
 */
function setup(log: WorkoutLog, mode: 'ios' | 'md' = 'ios', source: Routine | null = null) {
  const service = {
    // A write that never answers: the store keeps its optimistic copy.
    logSet: vi.fn(() => NEVER),
    addSet: vi.fn(() => of(set('s-copy'))),
    complete: vi.fn(() => of(log)),
  };
  const routineService = {
    get: vi.fn(() => of(source)),
    update: vi.fn(() => of(source)),
  };
  const navigate = vi.fn(() => Promise.resolve(true));
  const outlet = { swipeGesture: true };
  const stub = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutLogService, useValue: service },
      { provide: RoutineService, useValue: routineService },
      { provide: AuthStore, useValue: { user: () => ({ id: 'me' }) } },
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          queryParamMap: of(convertToParamMap({})),
        },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: FeedbackService, useValue: { error: stub, info: stub, success: stub } },
      { provide: RestAlertService, useValue: {} },
      { provide: NavController, useValue: {} },
      { provide: IonRouterOutlet, useValue: outlet },
      {
        provide: Config,
        useValue: {
          get: (key: string, fallback?: unknown) => (key === 'mode' ? mode : fallback),
          getBoolean: (_key: string, fallback = false) => fallback,
        },
      },
      { provide: ActiveWorkoutService, useValue: {} },
      { provide: RestCueService, useValue: {} },
      {
        provide: ActiveSessionStore,
        useValue: { passed: signal(new Set<string>()), end: stub },
      },
      { provide: StillTrainingService, useValue: { cancel: stub } },
      { provide: ScreenAwakeService, useValue: { release: stub } },
      { provide: LockScreenService, useValue: {} },
      {
        provide: WorkoutSettingsStore,
        useValue: { settings: signal(DEFAULT_WORKOUT_SETTINGS), load: stub },
      },
      { provide: ExerciseService, useValue: {} },
    ],
  });
  TestBed.overrideComponent(Logger, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Logger);
  destroy = () => fixture.destroy();
  const logger = fixture.componentInstance;
  logger.store.adopt(log);
  return { logger, service, routineService, navigate, outlet };
}

/** Your routine "Leg day", one exercise of one set: what `routineWorkout` was started from. */
function legDay(ownerId = 'me'): Routine {
  return {
    id: 'r-1',
    ownerId,
    source: 'USER',
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
    exerciseCount: 1,
    exercises: [
      {
        id: 'pe-a',
        exerciseId: 'cat-a',
        orderIndex: 0,
        supersetGroupId: null,
        notes: null,
        defaultSets: 1,
        targetRepsMin: 8,
        targetRepsMax: 8,
        targetWeightKg: 60,
        restAfterSeconds: null,
        sets: [
          {
            setType: ExerciseSetType.Normal,
            targetRepsMin: 8,
            targetRepsMax: 8,
            targetWeightKg: 60,
            targetDurationSeconds: null,
            targetDistanceMeters: null,
            restAfterSeconds: null,
          },
        ],
        hasVariedSets: false,
      },
    ],
  };
}

/** A workout started from "Leg day", every set ticked; `added` adds an exercise to it. */
function routineWorkout(added = false): WorkoutLog {
  const done = (id: string) => set(id, { isCompleted: true, reps: 8, weightKg: 60 });
  const exercises = [
    exercise('a', [done('a1')], { prescribedExercise: { id: 'pe-a', notes: null } }),
    ...(added ? [exercise('b', [done('b1')])] : []),
  ];
  return {
    ...workout(...exercises),
    sourceProgramId: 'r-1',
    sourceProgram: { id: 'r-1', name: 'Leg day', isSingleWorkout: true },
  } as WorkoutLog;
}

describe('Logger finish, from a routine', () => {
  /** The routine is read with the workout; the specs read it here instead. */
  const readSource = (logger: Logger) => logger['_loadSourceRoutine']();

  it('asks whether the routine changes too, and Update saves its new shape', () => {
    const { logger, service, routineService } = setup(routineWorkout(true), 'ios', legDay());
    readSource(logger);

    logger.finish();

    expect(logger.updateAskOpen()).toBe(true);
    expect(logger.updateTitle()).toBe('workouts.updateRoutine.title');
    expect(logger.updateNote()).toBe('You added b.');
    expect(service.complete).not.toHaveBeenCalled();

    logger.onUpdateChoice(RoutineUpdateChoices.Update);
    expect(service.complete).toHaveBeenCalledWith('wl-1');
    expect(routineService.update).toHaveBeenCalledWith('r-1', {
      exercises: [
        {
          exerciseId: 'cat-a',
          sets: [{ setType: 'NORMAL', targetRepsMin: 8, targetRepsMax: 8, targetWeightKg: 60 }],
        },
        {
          exerciseId: 'cat-b',
          sets: [{ setType: 'NORMAL', targetRepsMin: 8, targetRepsMax: 8, targetWeightKg: 60 }],
        },
      ],
    });
  });

  it('finishes without touching the routine on Keep', () => {
    const { logger, service, routineService } = setup(routineWorkout(true), 'ios', legDay());
    readSource(logger);
    logger.finish();

    logger.onUpdateChoice(RoutineUpdateChoices.Keep);

    expect(service.complete).toHaveBeenCalledWith('wl-1');
    expect(routineService.update).not.toHaveBeenCalled();
  });

  it('does not ask after a workout done as the routine has it', () => {
    const { logger, service } = setup(routineWorkout(), 'ios', legDay());
    readSource(logger);

    logger.finish();

    expect(logger.updateAskOpen()).toBe(false);
    expect(service.complete).toHaveBeenCalledWith('wl-1');
  });

  it('does not ask about a routine that is not yours', () => {
    const { logger, service } = setup(routineWorkout(true), 'ios', legDay('someone-else'));
    readSource(logger);

    logger.finish();

    expect(logger.updateAskOpen()).toBe(false);
    expect(service.complete).toHaveBeenCalledWith('wl-1');
  });

  // After the unticked-sets question, the routine's is next.
  it('asks after Finish and save when sets are left', () => {
    const log = routineWorkout(true);
    log.exercises![1].sets!.push(set('b2'));
    const { logger, service } = setup(log, 'ios', legDay());
    readSource(logger);

    logger.finish();
    expect(logger.finishSheetOpen()).toBe(true);
    logger.onFinishChoice(FinishChoices.Save);

    expect(logger.updateAskOpen()).toBe(true);
    expect(service.complete).not.toHaveBeenCalled();
  });
});

describe('Logger finish', () => {
  it('goes straight to the summary with every set ticked', () => {
    const { logger, service, navigate } = setup(
      workout(exercise('a', [set('a1', { isCompleted: true })])),
    );

    logger.finish();

    expect(logger.finishSheetOpen()).toBe(false);
    expect(service.complete).toHaveBeenCalledWith('wl-1');
    expect(navigate).toHaveBeenCalledWith(['/tabs/workouts/finish', 'wl-1'], {
      queryParams: { from: 'logger' },
      replaceUrl: true,
    });
  });

  it('asks first with sets unticked: save it as it stands, or discard it', () => {
    const { logger, service } = setup(
      workout(exercise('a', [set('a1', { isCompleted: true }), set('a2')])),
    );

    logger.finish();

    expect(logger.finishSheetOpen()).toBe(true);
    expect(logger.finishTitle()).toBe('workouts.logger.finishSheet.early.title');
    expect(logger.finishActions().map((action) => action.id)).toEqual([
      FinishChoices.Save,
      FinishChoices.Discard,
    ]);
    expect(service.complete).not.toHaveBeenCalled();

    logger.onFinishChoice(FinishChoices.Save);
    expect(service.complete).toHaveBeenCalledWith('wl-1');
  });

  // Completing an empty workout would mark a coach's plan day done with no
  // sets in it, and tell the coach so.
  it('offers only Discard with nothing ticked, and asks again before it', () => {
    const { logger, service } = setup(workout(exercise('a', [set('a1')])));

    logger.finish();

    expect(logger.finishSheetOpen()).toBe(true);
    expect(logger.finishTitle()).toBe('workouts.logger.finishSheet.nothing.title');
    expect(logger.finishActions().map((action) => action.id)).toEqual([FinishChoices.Discard]);

    logger.onFinishChoice(FinishChoices.Discard);
    expect(logger.discardConfirmOpen()).toBe(true);
    expect(service.complete).not.toHaveBeenCalled();
  });

  it('counts the exercises done for the finish-early line, skipped ones left out', () => {
    const { logger } = setup(
      workout(
        exercise('a', [set('a1', { isCompleted: true })]),
        exercise('b', [set('b1')]),
        exercise('c', [set('c1')], { isSkipped: true }),
      ),
    );

    expect(logger.exerciseProgress()).toEqual({ done: 1, total: 2 });
  });
});

describe('Logger volume', () => {
  it('says the weight lifted in ticked sets', () => {
    const ticked = set('a1', { isCompleted: true, weightKg: 60, reps: 8 });
    const { logger } = setup(workout(exercise('a', [ticked, set('a2')])));

    expect(logger.volumeLabel()).toBe('workouts.units.kg');
  });

  // A bodyweight session never reads "0 kg".
  it('says nothing until something loaded is ticked', () => {
    const bodyweight = set('a1', { isCompleted: true, reps: 12 });
    const unticked = set('a2', { weightKg: 60, reps: 8 });
    const { logger } = setup(workout(exercise('a', [bodyweight, unticked])));

    expect(logger.volumeLabel()).toBe('');
  });
});

describe('Logger collapse', () => {
  it('offers Collapse on a done exercise opened again, and folds it back', () => {
    const done = exercise('a', [set('a1', { isCompleted: true })]);
    const { logger } = setup(workout(done, exercise('b', [set('b1')])));

    logger.unfold(done);
    expect(logger.isFolded(done)).toBe(false);
    logger.actionsFor.set(done);
    expect(logger.actionsCanCollapse()).toBe(true);

    logger.fold(done);
    expect(logger.isFolded(done)).toBe(true);
  });

  it('offers no Collapse on an exercise still being worked', () => {
    const working = exercise('b', [set('b1', { isCompleted: true }), set('b2')]);
    const { logger } = setup(workout(working));

    logger.actionsFor.set(working);

    expect(logger.actionsCanCollapse()).toBe(false);
  });
});

describe('Logger previous', () => {
  it("fills the set with last time's numbers, without ticking it", () => {
    const squat = exercise('a', [set('a1')]);
    const { logger, service } = setup(workout(squat));

    logger.usePrevious(squat, set('a1'), set('old', { weightKg: 60, reps: 8, notes: 'easy' }));

    expect(service.logSet).toHaveBeenCalledWith('wl-1', 'a1', { weightKg: 60, reps: 8 });
  });

  it('leaves a ticked set as it is', () => {
    const squat = exercise('a', [set('a1', { isCompleted: true })]);
    const { logger, service } = setup(workout(squat));

    logger.usePrevious(squat, set('a1', { isCompleted: true }), set('old', { weightKg: 60 }));

    expect(service.logSet).not.toHaveBeenCalled();
  });
});

describe('Logger copy', () => {
  it('adds a set of the same type with the numbers this one shows, unticked', () => {
    const warmup = set('a1', { setType: ExerciseSetType.Warmup, weightKg: 40, reps: 10 });
    const { logger, service } = setup(workout(exercise('a', [warmup])));

    logger.copySet('a', warmup);

    expect(service.addSet).toHaveBeenCalledWith('wl-1', 'a', { setType: ExerciseSetType.Warmup });
    expect(service.logSet).toHaveBeenCalledWith('wl-1', 's-copy', { weightKg: 40, reps: 10 });
  });

  it('closes the swiped row as it copies', () => {
    const a1 = set('a1', { reps: 8 });
    const { logger, service } = setup(workout(exercise('a', [a1])));
    const sliding = { close: vi.fn(() => Promise.resolve(true)) };

    logger.swipeCopy(sliding as unknown as IonItemSliding, exercise('a', [a1]), a1);

    expect(sliding.close).toHaveBeenCalledOnce();
    expect(service.addSet).toHaveBeenCalledOnce();
  });
});

// A set swipes right to Copy, and iOS's drag from the left edge outranked it
// and popped the page past the leave sheet.
describe('Logger swipe back', () => {
  it('turns the stack swipe off while on screen, and back to the app setting after', () => {
    const { logger, outlet } = setup(workout());

    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    expect(outlet.swipeGesture).toBe(false);

    logger.ionViewWillLeave();
    expect(outlet.swipeGesture).toBe(true);
  });

  // An iOS swipe back to the logger fires will-enter as it starts. Turning
  // the gesture off there snapped the swipe back and left it dead.
  it('leaves the swipe alone until the page is on screen', () => {
    const { logger, outlet } = setup(workout());
    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    logger.ionViewWillLeave();

    logger.ionViewWillEnter();

    expect(outlet.swipeGesture).toBe(true);
  });

  it('leaves it off on leaving in md, where the app never has it', () => {
    const { logger, outlet } = setup(workout(), 'md');

    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    logger.ionViewWillLeave();

    expect(outlet.swipeGesture).toBe(false);
  });
});
