import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import {
  Config,
  IonItemSliding,
  IonRouterOutlet,
  NavController,
  Platform,
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { NEVER, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuthStore,
  DEFAULT_WORKOUT_SETTINGS,
  ExerciseKind,
  ExerciseService,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineService,
  WorkoutLog,
  WorkoutLogService,
  WorkoutSettings,
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
import { ExerciseActionIds, FinishChoices } from '../workouts.config';
import { Logger } from './logger';
import { BadgeTones } from './logger-flow';
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
 * jsdom), with the services it reaches stubbed. Its effects run only when a
 * spec calls `fixture.detectChanges()`, so the clock, the lock screen and
 * the scroll stay out otherwise.
 */
function setup(log: WorkoutLog, mode: 'ios' | 'md' = 'ios', source: Routine | null = null) {
  const service = {
    // A write that never answers: the store keeps its optimistic copy.
    logSet: vi.fn(() => NEVER),
    addSet: vi.fn(() => of(set('s-copy'))),
    complete: vi.fn(() => of(log)),
    setSupersets: vi.fn(() => of(undefined)),
    removeSets: vi.fn(() => of(undefined)),
    removeExercise: vi.fn(() => of(undefined)),
  };
  const routineService = {
    get: vi.fn(() => of(source)),
    update: vi.fn(() => of(source)),
  };
  const navigate = vi.fn(() => Promise.resolve(true));
  const outlet = { swipeGesture: true };
  // Android's back: the handler the page holds, null while it holds none.
  const back = {
    handler: null as ((processNextHandler: () => void) => void) | null,
    press(): () => void {
      const next = vi.fn();
      back.handler?.(next);
      return next;
    },
  };
  const backButton = {
    subscribeWithPriority: vi.fn(
      (_priority: number, handler: (processNextHandler: () => void) => void) => {
        back.handler = handler;
        return { unsubscribe: () => (back.handler = null) };
      },
    ),
  };
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
      { provide: Platform, useValue: { backButton } },
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
        useValue: {
          passed: signal(new Set<string>()),
          end: stub,
          track: stub,
          setRest: stub,
          setNext: stub,
        },
      },
      { provide: StillTrainingService, useValue: { cancel: stub } },
      { provide: ScreenAwakeService, useValue: { hold: stub, release: stub } },
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
  return { logger, fixture, service, routineService, navigate, outlet, back };
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

  // Every exercise folds, finished or not (user decision, 2026-11-18).
  it('folds an exercise still being worked, and a tap opens it again', () => {
    const working = exercise('b', [set('b1', { isCompleted: true }), set('b2')]);
    const { logger } = setup(workout(working));
    expect(logger.isFolded(working)).toBe(false);

    logger.actionsFor.set(working);
    expect(logger.actionsCanCollapse()).toBe(true);
    logger.fold(working);
    expect(logger.isFolded(working)).toBe(true);
    expect(logger.views()[0].done).toBe(false);

    logger.unfold(working);
    expect(logger.isFolded(working)).toBe(false);
  });

  it('keeps an exercise folded by hand folded once its last set is ticked', () => {
    const working = exercise('b', [set('b1', { isCompleted: true }), set('b2')]);
    const { logger } = setup(workout(working));
    logger.fold(working);

    logger.store.adopt(
      workout(exercise('b', [set('b1', { isCompleted: true }), set('b2', { isCompleted: true })])),
    );

    expect(logger.isFolded(working)).toBe(true);
  });

  it('still folds an exercise when it is finished after being folded and opened by hand', () => {
    const working = exercise('b', [set('b1', { isCompleted: true }), set('b2')]);
    const { logger } = setup(workout(working));
    logger.fold(working);
    logger.unfold(working);

    logger.store.adopt(
      workout(exercise('b', [set('b1', { isCompleted: true }), set('b2', { isCompleted: true })])),
    );

    expect(logger.isFolded(working)).toBe(true);
  });

  // The lock screen's "Other value" opens a set straight into the pad.
  it('opens a card folded by hand for good when one of its sets is opened', () => {
    const b2 = set('b2');
    const working = exercise('b', [set('b1', { isCompleted: true }), b2]);
    const { logger } = setup(workout(working));
    logger.fold(working);

    logger.openSet(working, b2);
    logger.closePad();

    expect(logger.isFolded(working)).toBe(false);
  });

  it('folds a whole superset mid-way from a member', () => {
    const a = exercise('a', [set('a1', { isCompleted: true }), set('a2')], { supersetGroupId: 1 });
    const b = exercise('b', [set('b1'), set('b2')], { supersetGroupId: 1 });
    const { logger } = setup(workout(a, b));

    logger.actionsFor.set(b);
    expect(logger.actionsCanCollapse()).toBe(true);
    logger.fold(b);

    const block = logger.blocks()[0];
    expect(block.kind === 'superset' && block.folded && !block.done).toBe(true);
    expect(logger.isFolded(a)).toBe(true);
  });

  // The fold is kept under a superset's first member. With rounds turned off
  // that member is its own card again, and a skipped card that read the fold
  // stayed on one line that nothing opened.
  it('never folds a skipped exercise, whatever a superset fold left behind', () => {
    const a = exercise('a', [set('a1')], { supersetGroupId: 1, isSkipped: true });
    const b = exercise('b', [set('b1')], { supersetGroupId: 1 });
    const { logger } = setup(workout(a, b));
    logger.fold(b);
    expect(logger.isFolded(b)).toBe(true);

    const settings = TestBed.inject(WorkoutSettingsStore).settings as WritableSignal<WorkoutSettings>;
    settings.set({ ...DEFAULT_WORKOUT_SETTINGS, supersetJump: false });

    expect(logger.isFolded(a)).toBe(false);
  });

  // A skipped exercise's card has no sets: there is nothing to fold.
  it('offers no Collapse on a skipped exercise', () => {
    const skipped = exercise('c', [set('c1')], { isSkipped: true });
    const { logger } = setup(workout(skipped));

    logger.actionsFor.set(skipped);

    expect(logger.actionsCanCollapse()).toBe(false);
  });
});

// A superset is laid out as an exercise lays out its sets (2026-11-18): every
// round as rows, done or ahead, under one heading when the members share it.
describe('Logger superset card', () => {
  const cardio = { kind: ExerciseKind.Cardio } as LoggedExercise['exercise'];
  const superset = (b: Partial<LoggedExercise> = {}) =>
    workout(
      exercise('a', [set('a1', { isCompleted: true }), set('a2'), set('a3')], { supersetGroupId: 1 }),
      exercise('b', [set('b1', { isCompleted: true }), set('b2'), set('b3')], {
        supersetGroupId: 1,
        ...b,
      }),
    );
  const card = (log: WorkoutLog) => {
    const block = setup(log).logger.blocks()[0];
    if (block.kind !== 'superset') throw new Error('Expected a superset');
    return block;
  };

  it('shows every round as set rows, the finished one and those ahead too', () => {
    const block = card(superset());

    expect(block.rounds.map((r) => r.rows.map((item) => item.row.set.id))).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3'],
    ]);
    expect(block.rounds.map((r) => r.done)).toEqual([true, false, false]);
    expect(block.current).toBe(2);
  });

  it('puts one heading over the rounds when the members record the same fields', () => {
    expect(card(superset()).columns).toEqual({ fields: ['weight', 'reps'], unilateral: false });
  });

  // The folded line, and the row's accessible name with it.
  it('sums a superset up by the round it is on while it is being worked', () => {
    expect(card(superset()).summary).toBe('workouts.superset.kicker');
  });

  it('sums a finished superset up by its rounds', () => {
    const done = (id: string) => set(id, { isCompleted: true });
    const finished = workout(
      exercise('a', [done('a1')], { supersetGroupId: 1 }),
      exercise('b', [done('b1')], { supersetGroupId: 1 }),
    );

    expect(card(finished).summary).toBe('workouts.superset.rounds');
  });

  it('has no heading when the members record different fields', () => {
    expect(card(superset({ exercise: cardio })).columns).toBeNull();
  });

  // A skipped member has no rows in the rounds, so it has no say in the heading.
  it('leaves a skipped member out of the heading', () => {
    expect(card(superset({ exercise: cardio, isSkipped: true })).columns).toEqual({
      fields: ['weight', 'reps'],
      unilateral: false,
    });
  });

  // A round has no menu of its own: any of its sets' menus removes it (2026-11-18).
  it('offers the round in a superset set’s menu, and removes every set in it', () => {
    const { logger, service } = setup(superset());
    const b = logger.store.exercises()[1];

    logger.openMenu(b, b.sets![1], { text: 'A2', name: 'b', tone: BadgeTones.Plain });
    expect(logger.menuRoundNumber()).toBe(2);

    logger.onRoundRemove();

    expect(service.removeSets).toHaveBeenCalledWith('wl-1', ['a2', 'b2']);
    expect(logger.store.exercises().map((e) => e.sets!.map((s) => s.id))).toEqual([
      ['a1', 'a3'],
      ['b1', 'b3'],
    ]);
  });

  it('offers no round for a set outside a superset', () => {
    const single = exercise('c', [set('c1')]);
    const { logger } = setup(workout(single));

    logger.openMenu(single, single.sets![0], { text: '1', name: 'Set 1', tone: BadgeTones.Plain });

    expect(logger.menuRoundNumber()).toBeNull();
  });
});

// The routine builder's link chip, between the logger's cards (2026-11-18).
describe('Logger superset links', () => {
  /** a, then b + c as a superset, then d. */
  const list = () =>
    workout(
      exercise('a', [set('a1')]),
      exercise('b', [set('b1')], { supersetGroupId: 1 }),
      exercise('c', [set('c1')], { supersetGroupId: 1 }),
      exercise('d', [set('d1')]),
    );

  it('puts a chip after every card but the last, linking it with the next', () => {
    const { logger } = setup(list());

    expect(logger.links()).toEqual([
      { index: 0, linked: false, a: 'a', b: 'b' },
      { index: 2, linked: false, a: 'c', b: 'd' },
      null,
    ]);
  });

  it('links a card into the superset after it, saving only what changed', () => {
    const { logger, service } = setup(list());

    logger.toggleLink(0);

    expect(service.setSupersets).toHaveBeenCalledWith('wl-1', [{ id: 'a', supersetGroupId: 1 }]);
    expect(logger.blocks().map((block) => block.kind)).toEqual(['superset', 'single']);
  });

  // With rounds off, every exercise is its own card, as in the builder.
  it('undoes a link from the chip while supersets show card by card', () => {
    const { logger, service } = setup(list());
    // The stub's settings are a writable signal.
    const settings = TestBed.inject(WorkoutSettingsStore).settings as WritableSignal<WorkoutSettings>;
    settings.set({ ...DEFAULT_WORKOUT_SETTINGS, supersetJump: false });
    expect(logger.links()[1]).toEqual({ index: 1, linked: true, a: 'b', b: 'c' });

    logger.toggleLink(1);

    expect(service.setSupersets).toHaveBeenCalledWith('wl-1', [
      { id: 'b', supersetGroupId: null },
      { id: 'c', supersetGroupId: null },
    ]);
  });

  it("offers Unlink in a member's ⋯, which takes it out of the superset", () => {
    const { logger, service } = setup(list());
    const b = logger.store.exercises()[1];

    logger.actionsFor.set(logger.store.exercises()[0]);
    expect(logger.actionsCanUnlink()).toBe(false);
    logger.actionsFor.set(b);
    expect(logger.actionsCanUnlink()).toBe(true);
    logger.onAction(ExerciseActionIds.Unlink);

    expect(service.setSupersets).toHaveBeenCalledWith('wl-1', [
      { id: 'b', supersetGroupId: null },
      { id: 'c', supersetGroupId: null },
    ]);
    expect(logger.blocks().every((block) => block.kind === 'single')).toBe(true);
  });

  // The card a hand fold was on is not the card the link makes.
  it('opens a card folded by hand when it joins a superset', () => {
    const { logger } = setup(list());
    const a = logger.store.exercises()[0];
    logger.fold(a);
    expect(logger.isFolded(a)).toBe(true);

    logger.toggleLink(0);

    expect(logger.isFolded(a)).toBe(false);
  });

  it('opens a superset folded by hand when an exercise joins it', () => {
    const { logger } = setup(list());
    const b = logger.store.exercises()[1];
    logger.fold(b);

    // The chip under b + c links d: only d's group changes.
    logger.toggleLink(2);

    expect(logger.isFolded(b)).toBe(false);
  });

  // Linking p and q renumbers b + c, so they are sent too; their card is the same one.
  it('keeps a superset folded by hand when a link above it only renumbers it', () => {
    const { logger, service } = setup(
      workout(
        exercise('p', [set('p1')]),
        exercise('q', [set('q1')]),
        exercise('b', [set('b1')], { supersetGroupId: 1 }),
        exercise('c', [set('c1')], { supersetGroupId: 1 }),
      ),
    );
    logger.fold(logger.store.exercises()[2]);

    logger.toggleLink(0);

    expect(service.setSupersets).toHaveBeenCalledWith('wl-1', [
      { id: 'p', supersetGroupId: 1 },
      { id: 'q', supersetGroupId: 1 },
      { id: 'b', supersetGroupId: 2 },
      { id: 'c', supersetGroupId: 2 },
    ]);
    expect(logger.isFolded(logger.store.exercises()[2])).toBe(true);
  });

  // With rounds off every exercise is its own card before and after.
  it('keeps a card folded by hand while supersets show card by card', () => {
    const { logger } = setup(list());
    const settings = TestBed.inject(WorkoutSettingsStore).settings as WritableSignal<WorkoutSettings>;
    settings.set({ ...DEFAULT_WORKOUT_SETTINGS, supersetJump: false });
    const a = logger.store.exercises()[0];
    logger.fold(a);

    logger.toggleLink(0);

    expect(logger.isFolded(a)).toBe(true);
  });

  // The API unlinks the exercise a superset of two is left with. Linked again
  // from a stale group, that exercise was left out of the save, and the
  // server kept no superset where the screen showed one.
  it('links the exercise a removed partner left behind, saving both', () => {
    const { logger, service } = setup(list());

    logger.store.removeExercise('c');
    logger.toggleLink(1);

    expect(service.setSupersets).toHaveBeenCalledWith('wl-1', [
      { id: 'b', supersetGroupId: 1 },
      { id: 'd', supersetGroupId: 1 },
    ]);
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

// The list moving on its own after a tick read on a phone as a jump
// (2026-11-18). It is brought to the set you are on as the workout opens,
// and stays where the person put it after that.
describe('Logger scroll', () => {
  afterEach(() => vi.useRealTimers());

  /** An 800px list with the set in progress 500px down; returns its scroll. */
  function list(logger: Logger) {
    const row = document.createElement('mh-set-row');
    row.setAttribute('data-focus', '');
    row.getBoundingClientRect = () => ({ top: 500, bottom: 548 }) as DOMRect;
    logger['_host'].nativeElement.appendChild(row);
    const scroller = document.createElement('div');
    scroller.getBoundingClientRect = () => ({ top: 0, bottom: 800 }) as DOMRect;
    const scrollToPoint = vi.fn(() => Promise.resolve());
    (logger as unknown as { _content: () => unknown })._content = () => ({
      getScrollElement: () => Promise.resolve(scroller),
      scrollToPoint,
    });
    return scrollToPoint;
  }

  it('opens on the set in progress, and does not scroll after a tick', async () => {
    vi.useFakeTimers();
    const { logger, fixture } = setup(workout(exercise('a', [set('a1'), set('a2')])));
    const scrollToPoint = list(logger);

    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(200);
    expect(scrollToPoint).toHaveBeenCalledOnce();

    // a1 ticked: the focus moves on to a2.
    logger.store.adopt(workout(exercise('a', [set('a1', { isCompleted: true }), set('a2')])));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(200);

    expect(logger.focus()?.setId).toBe('a2');
    expect(scrollToPoint).toHaveBeenCalledOnce();
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

// Android's back, the button or the system's swipe in from an edge, popped
// the page with the workout still running, past the leave sheet's question.
describe('Logger Android back', () => {
  it('asks before leaving, as the ⌄ does', () => {
    const { logger, back } = setup(workout(exercise('a', [set('a1')])), 'md');
    logger.ionViewWillEnter();
    logger.ionViewDidEnter();

    const next = back.press();

    expect(logger.leaveOpen()).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('closes the pad first, and asks on the next back', () => {
    const a1 = set('a1');
    const a = exercise('a', [a1]);
    const { logger, back } = setup(workout(a), 'md');
    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    logger.openSet(a, a1);

    back.press();
    expect(logger.editing()).toBeNull();
    expect(logger.leaveOpen()).toBe(false);

    back.press();
    expect(logger.leaveOpen()).toBe(true);
  });

  it('lets go of the back once the page has left, so the page in front owns it', () => {
    const { logger, back } = setup(workout(exercise('a', [set('a1')])), 'md');
    logger.ionViewWillEnter();
    logger.ionViewDidEnter();

    logger.ionViewWillLeave();

    expect(back.handler).toBeNull();
  });

  it('takes it again on coming back to the page', () => {
    const { logger, back } = setup(workout(exercise('a', [set('a1')])), 'md');
    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    logger.ionViewWillLeave();

    logger.ionViewWillEnter();
    logger.ionViewDidEnter();
    back.press();

    expect(logger.leaveOpen()).toBe(true);
  });
});
