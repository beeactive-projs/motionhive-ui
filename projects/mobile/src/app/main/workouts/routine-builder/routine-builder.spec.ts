import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import {
  Config,
  IonRouterOutlet,
  NavController,
  Platform,
  ReorderEndCustomEvent,
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AppModeStore,
  AuthStore,
  CreateRoutinePayload,
  Exercise,
  ExerciseKind,
  ExerciseLevel,
  ExerciseSetType,
  Routine,
  RoutineService,
  RoutineSources,
  SetFields,
  UpdateRoutinePayload,
  WorkoutLogService,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { RoutineActionsService } from '../_services/routine-actions.service';
import { WorkoutSettingsStore } from '../_services/workout-settings.store';
import { ROUTINE_EDIT_PARAM } from '../workouts.config';
import { RoutineBuilder } from './routine-builder';

const squat = { id: 'squat', name: 'Back squat', kind: ExerciseKind.Strength, thumbnailUrl: null, isUnilateral: false } as Exercise;
const plank = { id: 'plank', name: 'Plank', kind: ExerciseKind.Duration, thumbnailUrl: null, isUnilateral: false } as Exercise;
const pushUp = { id: 'pushup', name: 'Push-up', kind: ExerciseKind.Bodyweight, thumbnailUrl: null, isUnilateral: false } as Exercise;

function savedRoutine(id: string): Routine {
  return {
    id,
    ownerId: 'me',
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
        id: 'pe-1',
        exerciseId: 'squat',
        orderIndex: 0,
        supersetGroupId: null,
        notes: null,
        defaultSets: 1,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetWeightKg: 60,
        restAfterSeconds: null,
        sets: [
          {
            setType: ExerciseSetType.Normal,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetWeightKg: 60,
            targetDurationSeconds: null,
            targetDistanceMeters: null,
            restAfterSeconds: null,
          },
        ],
        hasVariedSets: false,
        exercise: { id: 'squat', name: 'Back squat', slug: 'squat', kind: 'STRENGTH', thumbnailUrl: null },
      },
    ],
  };
}

interface Setup {
  id?: string;
  coach?: boolean;
  /** The stack's outlet, to watch the edge swipe; there is none by default. */
  outlet?: { swipeGesture: boolean };
  /** iOS mode, where the edge swipe is on by default. */
  ios?: boolean;
  /** Another workout is open: every start is put off. */
  blocked?: boolean;
}

function setup({ id = 'new', coach = false, outlet, ios = false, blocked = false }: Setup = {}) {
  const routineService = {
    get: vi.fn((rid: string, _opts?: { silent?: boolean }) => of(savedRoutine(rid))),
    create: vi.fn((_: CreateRoutinePayload) => of(savedRoutine('r-new'))),
    update: vi.fn((rid: string, _: UpdateRoutinePayload) => of(savedRoutine(rid))),
    start: vi.fn(() => of({ id: 'log-1' })),
  };
  const router = {
    url: `/tabs/workouts/routine/${id}`,
    navigate: vi.fn(() => Promise.resolve(true)),
  };
  const navController = { navigateBack: vi.fn() };
  const feedback = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
  const route = {
    snapshot: { paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap({}) },
  };
  const translate = { instant: vi.fn((key: string) => key) };
  const settingsStore = { settings: () => ({ defaultRestSeconds: 90 }), load: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: RoutineService, useValue: routineService },
      { provide: WorkoutLogService, useValue: { lastForExercise: () => of([]) } },
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: router },
      { provide: NavController, useValue: navController },
      {
        provide: Platform,
        useValue: { backButton: { subscribeWithPriority: () => ({ unsubscribe: () => undefined }) } },
      },
      {
        provide: Config,
        useValue: {
          get: () => (ios ? 'ios' : 'md'),
          getBoolean: (_key: string, fallback?: boolean) => fallback ?? false,
        },
      },
      ...(outlet ? [{ provide: IonRouterOutlet, useValue: outlet }] : []),
      { provide: FeedbackService, useValue: feedback },
      {
        provide: ActiveWorkoutService,
        useValue: {
          startOrResume: (start: () => void, options: { onBlocked?: () => void } = {}) =>
            blocked ? options.onBlocked?.() : start(),
        },
      },
      { provide: RoutineActionsService, useValue: {} },
      { provide: AuthStore, useValue: { isInstructor: () => coach, user: () => ({ id: 'me' }) } },
      { provide: AppModeStore, useValue: { mode: () => (coach ? 'coach' : 'train') } },
      { provide: WorkoutSettingsStore, useValue: settingsStore },
      { provide: TranslateService, useValue: translate },
    ],
  });
  TestBed.overrideComponent(RoutineBuilder, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(RoutineBuilder);
  const page = fixture.componentInstance;
  return {
    page,
    fixture,
    routineService,
    router,
    route,
    navController,
    feedback,
    translate,
    settingsStore,
  };
}

/** A new routine with one movement in it, as the page shows it. */
function withSquat() {
  const ctx = setup();
  ctx.page.ionViewWillEnter();
  ctx.page.onPicked([squat]);
  return ctx;
}

describe('RoutineBuilder, the draft', () => {
  // Opening an exercise and coming back wiped a new routine: entering again
  // reset it, as every visit to `new` did.
  it('keeps a new routine’s draft after a look at an exercise’s page', () => {
    const { page } = withSquat();
    page.onName('Leg day');

    page.openExercise(page.exercises()[0]);
    page.ionViewWillLeave();
    page.ionViewWillEnter();

    expect(page.name()).toBe('Leg day');
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['squat']);
  });

  // An iOS edge swipe fires will-enter on the page underneath as it starts,
  // and nothing more if it is let go. Using the draft up there wiped a new
  // routine on the next real return, and turning the swipe off cut the
  // gesture off mid-drag, so every swipe snapped back.
  it('keeps the draft and the swipe through an edge swipe that was let go', () => {
    const outlet = { swipeGesture: true };
    const { page } = setup({ outlet, ios: true });
    page.ionViewWillEnter();
    page.ionViewDidEnter();
    page.onPicked([squat]);
    page.onName('Leg day');
    expect(outlet.swipeGesture).toBe(false);

    page.openExercise(page.exercises()[0]);
    page.ionViewWillLeave();
    expect(outlet.swipeGesture).toBe(true);

    page.ionViewWillEnter();
    expect(outlet.swipeGesture).toBe(true);

    page.ionViewWillEnter();
    page.ionViewDidEnter();
    expect(page.name()).toBe('Leg day');
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['squat']);
    expect(outlet.swipeGesture).toBe(false);
  });

  // User decision, 2026-11-17: looking at another tab keeps the draft. A tab
  // tap lands on the tab's first page and destroys this one.
  it('parks a draft the tab bar throws away, for the next new routine in that tab', () => {
    const { page, fixture } = withSquat();
    page.onName('Leg day');

    page.ionViewWillLeave();
    fixture.destroy();
    const next = TestBed.createComponent(RoutineBuilder).componentInstance;
    next.ionViewWillEnter();

    expect(next.name()).toBe('Leg day');
    expect(next.exercises().map((row) => row.exerciseId)).toEqual(['squat']);
    expect(next.guarded()).toBe(true);
  });

  it('hands a parked draft back once, with new rows keyed apart from it', () => {
    const { page, fixture } = withSquat();
    page.ionViewWillLeave();
    fixture.destroy();

    const next = TestBed.createComponent(RoutineBuilder).componentInstance;
    next.ionViewWillEnter();
    next.onPicked([plank]);
    const keys = next.exercises().map((row) => row.key);
    const third = TestBed.createComponent(RoutineBuilder).componentInstance;
    third.ionViewWillEnter();

    expect(new Set(keys).size).toBe(2);
    expect(third.exercises()).toEqual([]);
  });

  it('brings back an edit of a saved routine when it opens again', () => {
    const { page, fixture } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();
    page.onName('Leg day, heavy');
    page.notes.set('Heavy first');

    page.ionViewWillLeave();
    fixture.destroy();
    const next = TestBed.createComponent(RoutineBuilder).componentInstance;
    next.ionViewWillEnter();

    expect(next.editMode()).toBe(true);
    expect(next.name()).toBe('Leg day, heavy');
    expect(next.notes()).toBe('Heavy first');
    expect(next.guarded()).toBe(true);
  });

  // A "Save and start" whose start was put off left the saved routine at
  // `new`: an edit of it was parked there and came back as a new routine,
  // so Save made a second copy.
  it('parks an edit of a routine saved from new under the routine, not under new', () => {
    const { page, fixture, router, route, feedback } = setup({ blocked: true });
    page.ionViewWillEnter();
    page.onPicked([squat]);
    page.onName('Leg day');
    page.saveAndStart();
    expect(feedback.success).toHaveBeenCalledWith('workouts.routineBuilder.toast.saved');
    expect(page.showOverview()).toBe(true);

    page.edit();
    page.onName('Leg day, heavy');
    page.ionViewWillLeave();
    fixture.destroy();

    const fresh = TestBed.createComponent(RoutineBuilder).componentInstance;
    fresh.ionViewWillEnter();
    expect(fresh.isNew()).toBe(true);
    expect(fresh.exercises()).toEqual([]);

    router.url = '/tabs/workouts/routine/r-new';
    route.snapshot.paramMap = convertToParamMap({ id: 'r-new' });
    const reopened = TestBed.createComponent(RoutineBuilder).componentInstance;
    reopened.ionViewWillEnter();
    expect(reopened.name()).toBe('Leg day, heavy');
    expect(reopened.editMode()).toBe(true);
  });

  it('parks nothing once the routine is saved, nor what was never changed', () => {
    const saved = withSquat();
    saved.page.onName('Leg day');
    saved.page.save();
    saved.page.ionViewWillLeave();
    saved.fixture.destroy();

    const untouched = TestBed.createComponent(RoutineBuilder);
    untouched.componentInstance.ionViewWillEnter();
    untouched.componentInstance.ionViewWillLeave();
    untouched.destroy();

    const next = TestBed.createComponent(RoutineBuilder).componentInstance;
    next.ionViewWillEnter();
    expect(next.exercises()).toEqual([]);
    expect(next.guarded()).toBe(false);
  });

  it('starts clean once a new routine has been saved', () => {
    const { page } = withSquat();
    page.onName('Leg day');

    page.save();
    page.ionViewWillLeave();
    page.ionViewWillEnter();

    expect(page.name()).toBe('');
    expect(page.exercises()).toEqual([]);
  });

  it('adds a picked movement with three sets, skipping one already in', () => {
    const { page, feedback } = withSquat();

    page.onPicked([squat, plank]);

    expect(page.exercises().map((row) => [row.exerciseId, row.sets.length])).toEqual([
      ['squat', 3],
      ['plank', 3],
    ]);
    expect(feedback.info).toHaveBeenCalled();
  });

  // A hold takes a weight too: a weighted plank, a loaded carry.
  it('draws a set’s cells by the exercise’s kind', () => {
    const { page } = withSquat();
    page.onPicked([plank]);

    expect(page.views().map((view) => view.fields)).toEqual([
      [SetFields.Weight, SetFields.Reps],
      [SetFields.Weight, SetFields.Duration],
    ]);
  });

  it('is unsaved once something changes, and asks before it goes', () => {
    const { page } = setup();
    page.ionViewWillEnter();
    expect(page.guarded()).toBe(false);

    page.onPicked([squat]);
    expect(page.guarded()).toBe(true);

    page.askLeave();
    expect(page.discardOpen()).toBe(true);
  });

  it('leaves on Discard, as the back button would', async () => {
    const { page, navController } = withSquat();

    page.askLeave();
    await page.confirmDiscard();

    expect(navController.navigateBack).toHaveBeenCalledWith('/tabs/workouts');
  });

  it('puts an edited routine back as it was on Discard', async () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();
    page.onName('Something else');

    page.askCancel();
    expect(page.discardOpen()).toBe(true);
    await page.confirmDiscard();

    expect(page.name()).toBe('Leg day');
    expect(page.editMode()).toBe(false);
  });

  it('cancels an untouched edit without asking', () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();

    page.askCancel();

    expect(page.discardOpen()).toBe(false);
    expect(page.editMode()).toBe(false);
  });
});

// The workout's header (user decision, 2026-11-17): the name over what is
// in it so far, then the ⋯ and Save as the honey button.
describe('RoutineBuilder, the header', () => {
  it('names a new routine until it is named, then shows the name typed', () => {
    const { page } = setup();
    page.ionViewWillEnter();
    expect(page.headerName()).toBe('workouts.common.newRoutine');

    page.onName('  Leg day ');

    expect(page.headerName()).toBe('Leg day');
  });

  it('says how many exercises and sets under the name, once there are any', () => {
    const { page } = setup();
    page.ionViewWillEnter();
    expect(page.headerMeta()).toBe('');

    page.onPicked([squat]);

    expect(page.headerMeta()).toBe('1 exercise · 3 sets');
  });

  it('offers adding in the ⋯, reordering once there are two, discarding once changed', () => {
    const { page } = setup();
    page.ionViewWillEnter();
    const ids = () => page.options().map((option) => option.id);
    expect(ids()).toEqual(['addExercises']);

    page.onPicked([squat, plank]);

    expect(ids()).toEqual(['addExercises', 'reorder', 'discard']);
  });

  it('opens the picker and the reorder from the ⋯', () => {
    const { page } = withSquat();
    page.openOptions();
    expect(page.optionsOpen()).toBe(true);

    page.onOption('addExercises');
    expect(page.pickerOpen()).toBe(true);

    page.onOption('reorder');
    expect(page.reordering()).toBe(true);
    expect(page.reorderRows()).toEqual(page.exercises());
  });

  it('asks before Discard drops a new routine, then leaves', async () => {
    const { page, navController } = withSquat();

    page.onOption('discard');
    expect(page.discardOpen()).toBe(true);
    await page.confirmDiscard();

    expect(navController.navigateBack).toHaveBeenCalledWith('/tabs/workouts');
  });

  it('asks before Discard drops an edit, then shows the routine as saved', async () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();
    page.onName('Something else');

    page.onOption('discard');
    expect(page.discardOpen()).toBe(true);
    await page.confirmDiscard();

    expect(page.name()).toBe('Leg day');
    expect(page.editMode()).toBe(false);
  });
});

describe('RoutineBuilder, the set table', () => {
  it('walks the pad through a set’s fields, then on to the next set', () => {
    const { page } = withSquat();
    const row = page.exercises()[0];

    page.editCell(row, row.sets[0], SetFields.Weight);
    page.onPadAction('60');
    expect(page.editing()).toMatchObject({ setKey: row.sets[0].key, field: SetFields.Reps });

    page.onPadAction('8');
    expect(page.editing()).toMatchObject({ setKey: row.sets[1].key, field: SetFields.Weight });
    expect(page.exercises()[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8 });
  });

  // The pad stayed docked with no title, and its Done did nothing.
  it('closes the pad when the exercise it types into is removed', () => {
    const { page } = withSquat();
    page.onPicked([plank]);

    page.editAll(page.exercises()[0], SetFields.Weight);
    page.remove(1);
    expect(page.editing()).not.toBeNull();

    page.remove(0);
    expect(page.editing()).toBeNull();
  });

  it('closes the pad when its cell has gone', () => {
    const { page } = withSquat();
    const row = page.exercises()[0];

    page.editCell(row, row.sets[0], SetFields.Weight);
    page.exercises.set([]);
    page.onPadAction('60');

    expect(page.editing()).toBeNull();
  });

  it('closes the pad on the last cell of the last set', () => {
    const { page } = withSquat();
    const row = page.exercises()[0];

    page.editCell(row, row.sets[2], SetFields.Reps);
    page.onPadAction('5');

    expect(page.editing()).toBeNull();
  });

  it('keeps a rep range when its cell is opened and left as it was', () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();
    const row = page.exercises()[0];

    page.editCell(row, row.sets[0], SetFields.Reps);
    expect(page.draft()).toBe('8');
    page.onPadAction('8');

    expect(page.exercises()[0].sets[0]).toMatchObject({ reps: 8, repsMax: 12 });
    expect(page.views()[0].rows[0].texts).toEqual({ reps: '8–12' });
    expect(page.dirty()).toBe(false);
  });

  it('adds a set like the one before it, and copies and deletes one', () => {
    const { page } = withSquat();
    const row = page.exercises()[0];
    page.editCell(row, row.sets[2], SetFields.Weight);
    page.onPadAction('70');
    page.closePad();

    page.addSet(page.exercises()[0]);
    expect(page.exercises()[0].sets[3]).toMatchObject({ weightKg: 70 });

    const fresh = page.exercises()[0];
    page.copySet(fresh, fresh.sets[0]);
    expect(page.exercises()[0].sets).toHaveLength(5);

    page.removeSet(page.exercises()[0], page.exercises()[0].sets[0]);
    expect(page.exercises()[0].sets).toHaveLength(4);
  });

  it('marks a set as a warm-up from its menu', () => {
    const { page } = withSquat();
    const row = page.exercises()[0];

    page.openMenu(row, row.sets[0], page.views()[0].rows[0].badge);
    page.onSetType(ExerciseSetType.Warmup);

    expect(page.exercises()[0].sets[0].setType).toBe(ExerciseSetType.Warmup);
  });

  // One row per target on the card (user decision, 2026-11-16).
  it('steps a target on every set, and the sets with the first row', () => {
    const { page } = withSquat();
    const row = () => page.exercises()[0];

    page.stepTarget(row(), { field: SetFields.Weight, delta: 1 });
    page.stepTarget(row(), { field: SetFields.Weight, delta: 1 });
    page.stepTarget(row(), { field: SetFields.Reps, delta: 1 });
    page.stepTarget(row(), { field: null, delta: 1 });

    expect(row().sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [5, 1],
      [5, 1],
      [5, 1],
      [5, 1],
    ]);
  });

  it('types a row’s value into every set, then moves on to the next row', () => {
    const { page } = withSquat();

    page.editAll(page.exercises()[0], SetFields.Reps);
    expect(page.keypadLabel()).toBe('Back squat · workouts.routineBuilder.targets.reps');
    // The next row by its own name ("Weight"), not the table's "kg".
    expect(page.keypadAction().label).toBe('workouts.routineBuilder.targets.weight');
    expect(page.views()[0].activeField).toBe(SetFields.Reps);
    page.onPadAction('10');
    expect(page.editing()).toMatchObject({ field: SetFields.Weight });

    page.onPadAction('62.5');
    expect(page.editing()).toBeNull();
    expect(page.exercises()[0].sets.every((set) => set.reps === 10 && set.weightKg === 62.5)).toBe(
      true,
    );
  });

  it('keeps a rep range when its row is opened and left as it was', () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();

    page.editAll(page.exercises()[0], SetFields.Reps);
    page.onPadAction('8');

    expect(page.exercises()[0].sets[0]).toMatchObject({ reps: 8, repsMax: 12 });
    expect(page.dirty()).toBe(false);
  });

  it('plans set by set, and back to one value for every set', () => {
    const { page } = withSquat();
    page.stepTarget(page.exercises()[0], { field: SetFields.Reps, delta: 1 });

    page.togglePerSet(page.exercises()[0]);
    expect(page.exercises()[0].perSet).toBe(true);
    const row = page.exercises()[0];
    page.editCell(row, row.sets[1], SetFields.Reps);
    page.onPadAction('6');
    page.closePad();

    page.togglePerSet(page.exercises()[0]);
    expect(page.exercises()[0].perSet).toBe(false);
    expect(page.exercises()[0].sets.map((set) => set.reps)).toEqual([1, 1, 1]);
  });

  it('opens a saved exercise whose sets differ set by set', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    const pyramid = savedRoutine('r-1');
    const [exercise] = pyramid.exercises!;
    exercise.sets = [
      { ...exercise.sets[0], targetWeightKg: 60 },
      { ...exercise.sets[0], targetWeightKg: 70 },
    ];
    routineService.get.mockReturnValueOnce(of(pyramid));
    page.ionViewWillEnter();
    page.edit();

    expect(page.exercises()[0].perSet).toBe(true);
    expect(page.views()[0].rows).toHaveLength(2);
  });

  it('shows an exercise’s own rest on its chip, from the rest sheet', () => {
    const { page } = withSquat();
    expect(page.views()[0].restChip).toBe('');

    page.openRest(page.exercises()[0].key);
    page.pickRest('120');

    expect(page.views()[0].restChip).toBe('2:00');
  });

  // The chip showed "2:00" and was announced as "Rest for Back squat".
  it('names the rest chip with the rest it stands for', () => {
    const { page, translate } = withSquat();

    expect(page.views()[0].restName).toBe('workouts.routineBuilder.rest.exerciseInherited');
    expect(translate.instant).toHaveBeenCalledWith('workouts.routineBuilder.rest.exerciseInherited', {
      name: 'Back squat',
      value: '1:30',
    });

    page.openRest(page.RoutineRest);
    page.pickRest('150');
    page.views();
    expect(translate.instant).toHaveBeenCalledWith('workouts.routineBuilder.rest.exerciseInherited', {
      name: 'Back squat',
      value: '2:30',
    });

    page.openRest(page.exercises()[0].key);
    page.pickRest('120');
    expect(page.views()[0].restName).toBe('workouts.routineBuilder.rest.exerciseOwn');
    expect(translate.instant).toHaveBeenCalledWith('workouts.routineBuilder.rest.exerciseOwn', {
      name: 'Back squat',
      value: '2:00',
    });
  });

  // The catalogue files Plank under strength: its 45 s hold was drawn
  // nowhere in the builder.
  it('draws a hold saved on a strength move, so it can be changed', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    const plankDay = savedRoutine('r-1');
    const [exercise] = plankDay.exercises!;
    exercise.sets = [
      {
        ...exercise.sets[0],
        targetRepsMin: null,
        targetRepsMax: null,
        targetWeightKg: null,
        targetDurationSeconds: 45,
      },
    ];
    routineService.get.mockReturnValueOnce(of(plankDay));
    page.ionViewWillEnter();
    page.edit();

    expect(page.views()[0].fields).toEqual([SetFields.Weight, SetFields.Reps, SetFields.Duration]);
  });

  it('offers a weight on a bodyweight move, and adds it', () => {
    const { page } = withSquat();
    page.onPicked([pushUp]);
    expect(page.views()[1].canAddWeight).toBe(true);

    page.addWeight(page.exercises()[1]);

    expect(page.views()[1].canAddWeight).toBe(false);
    expect(page.views()[1].fields).toEqual([SetFields.Weight, SetFields.Reps]);
  });

  it('steps the sets, never below one', () => {
    const { page } = withSquat();

    page.setCount(page.exercises()[0], 1);
    expect(page.exercises()[0].sets).toHaveLength(4);
    for (let i = 0; i < 5; i++) page.setCount(page.exercises()[0], -1);
    expect(page.exercises()[0].sets).toHaveLength(1);
  });

  it('links two exercises with the chip between them', () => {
    const { page } = withSquat();
    page.onPicked([plank]);

    page.toggleLink(0);
    expect(page.views().map((view) => [view.tag, view.linkedToNext])).toEqual([
      ['A1', true],
      ['A2', false],
    ]);

    page.toggleLink(0);
    expect(page.views()[0].linkedToNext).toBe(false);
  });

  it('offers the moves there is room for, swap and reorder in the ⋮', () => {
    const { page } = withSquat();
    page.openExerciseActions(page.exercises()[0]);
    expect(page.exerciseActions().map((action) => action.id)).toEqual(['swap']);

    page.onPicked([plank]);
    expect(page.exerciseActions().map((action) => action.id)).toEqual(['moveDown', 'swap', 'reorder']);
    page.openExerciseActions(page.exercises()[1]);
    expect(page.exerciseActions().map((action) => action.id)).toEqual(['moveUp', 'swap', 'reorder']);
  });

  // The drag mode could not be reached without dragging (WCAG 2.5.7).
  it('moves an exercise one place from its ⋮, splitting a superset it leaves', () => {
    const { page } = withSquat();
    page.onPicked([plank, pushUp]);
    page.toggleLink(0);
    const order = () => page.exercises().map((row) => row.exerciseId);
    page.openExerciseActions(page.exercises()[0]);

    page.onExerciseAction('moveDown');
    expect(order()).toEqual(['plank', 'squat', 'pushup']);
    expect(page.views()[0].tag).toBe('A1');

    page.onExerciseAction('moveDown');
    expect(order()).toEqual(['plank', 'pushup', 'squat']);
    expect(page.views().map((view) => view.tag)).toEqual([null, null, null]);

    page.onExerciseAction('moveDown');
    expect(order()).toEqual(['plank', 'pushup', 'squat']);

    page.onExerciseAction('moveUp');
    expect(order()).toEqual(['plank', 'squat', 'pushup']);
  });

  const drag = (page: RoutineBuilder, from: number, to: number, complete = vi.fn()) =>
    page.onReorder({ detail: { from, to, complete } } as unknown as ReorderEndCustomEvent);

  it('drags a copy of the order, and lets Ionic move nothing', () => {
    const { page } = withSquat();
    page.onPicked([plank]);
    const complete = vi.fn();
    page.startReorder();
    expect(page.reordering()).toBe(true);

    drag(page, 1, 0, complete);

    expect(complete).toHaveBeenCalledWith(false);
    expect(page.reorderRows().map((row) => row.exerciseId)).toEqual(['plank', 'squat']);
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['squat', 'plank']);
  });

  it('keeps the dragged order on Done', () => {
    const { page } = withSquat();
    page.onPicked([plank, pushUp]);
    page.startReorder();

    drag(page, 2, 0);
    page.doneReorder();

    expect(page.reordering()).toBe(false);
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['pushup', 'squat', 'plank']);
  });

  // Back out of the reorder left the drags in the routine: there was no way
  // to go back without changes.
  it('leaves the order as it was on back', () => {
    const { page } = withSquat();
    page.onPicked([plank, pushUp]);
    page.startReorder();

    drag(page, 2, 0);
    page.cancelReorder();

    expect(page.reordering()).toBe(false);
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['squat', 'plank', 'pushup']);

    // The next reorder starts from the routine, not from the dropped drags.
    page.startReorder();
    expect(page.reorderRows().map((row) => row.exerciseId)).toEqual(['squat', 'plank', 'pushup']);
  });

  it('splits a superset only where the final order breaks it', () => {
    const { page } = withSquat();
    page.onPicked([plank, pushUp]);
    page.toggleLink(0);
    page.startReorder();

    // Apart, then back together: still a pair.
    drag(page, 0, 2);
    drag(page, 2, 0);
    page.doneReorder();
    expect(page.views().map((view) => view.tag)).toEqual(['A1', 'A2', null]);

    // Apart for good: the pair splits.
    page.startReorder();
    drag(page, 0, 2);
    page.doneReorder();
    expect(page.exercises().map((row) => row.exerciseId)).toEqual(['plank', 'pushup', 'squat']);
    expect(page.views().map((view) => view.tag)).toEqual([null, null, null]);
  });

  it('opens the reorder from the ⋮ with the pad closed', () => {
    const { page } = withSquat();
    page.onPicked([plank]);
    page.openExerciseActions(page.exercises()[1]);

    page.onExerciseAction('reorder');

    expect(page.reordering()).toBe(true);
    expect(page.editing()).toBeNull();
    expect(page.reorderRows().map((row) => row.exerciseId)).toEqual(['squat', 'plank']);
  });
});

describe('RoutineBuilder, loading', () => {
  // The page draws its own "Couldn't open this routine"; the global error
  // dialog opened over it as well.
  it('reads the routine silently', () => {
    const { page, routineService } = setup({ id: 'r-1' });

    page.ionViewWillEnter();

    expect(routineService.get).toHaveBeenCalledWith('r-1', { silent: true });
  });

  // Opened to edit and failed: Cancel showed, and only turned into a back
  // chevron when tapped.
  it('is not editing a saved routine until it has loaded', () => {
    const { page, routineService, route } = setup({ id: 'r-1' });
    route.snapshot.queryParamMap = convertToParamMap({ [ROUTINE_EDIT_PARAM]: '' });
    routineService.get.mockReturnValueOnce(throwError(() => new Error('down')));

    page.ionViewWillEnter();
    expect(page.showError()).toBe(true);
    expect(page.editMode()).toBe(true);
    expect(page.editingSaved()).toBe(false);

    page.load();
    expect(page.editingSaved()).toBe(true);
  });
});

describe('RoutineBuilder, the read view', () => {
  it('says what a saved routine holds under its name, as the builder’s header does', () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();

    expect(page.showOverview()).toBe(true);
    expect(page.overviewMeta()).toBe('1 exercise · 1 set');
  });

  // Saved by the simple editor: no set rows, only the flat summary, which
  // the list under the name stands in for in the same way.
  it('counts the summary’s sets when a routine has no set rows', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    const routine = savedRoutine('r-1');
    routine.exercises![0] = { ...routine.exercises![0], sets: [], defaultSets: 4 };
    routineService.get.mockReturnValueOnce(of(routine));

    page.ionViewWillEnter();

    expect(page.overviewMeta()).toBe('1 exercise · 4 sets');
  });

  it('adds a starter’s level after the counts', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    routineService.get.mockReturnValueOnce(
      of({
        ...savedRoutine('r-1'),
        source: RoutineSources.System,
        ownerId: null,
        level: ExerciseLevel.Beginner,
      }),
    );

    page.ionViewWillEnter();

    expect(page.overviewMeta()).toBe('1 exercise · 1 set · Beginner');
  });

  it('reads the rest between sets: the person’s default until the routine sets one', () => {
    const { page, routineService, settingsStore } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    expect(settingsStore.load).toHaveBeenCalled();
    expect(page.overviewRest()).toBe('Default (1:30)');

    routineService.get.mockReturnValueOnce(of({ ...savedRoutine('r-1'), defaultRestSeconds: 120 }));
    page.load();

    expect(page.overviewRest()).toBe('2:00');
  });

  // The read view is what Start runs: an unsaved edit never shows on it.
  it('shows the saved rest, not the draft’s', () => {
    const { page } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();

    page.openRest(page.RoutineRest);
    page.pickRest('60');

    expect(page.defaultRestLabel()).toBe('1:00');
    expect(page.overviewRest()).toBe('Default (1:30)');
  });
});

describe('RoutineBuilder, the notes', () => {
  it('saves a new routine’s note trimmed', () => {
    const { page, routineService } = withSquat();
    page.onName('Leg day');
    page.notes.set('  Heavy first  ');

    page.save();

    expect(routineService.create.mock.calls[0][0].notes).toBe('Heavy first');
  });

  it('leaves an empty note out of a new routine', () => {
    const { page, routineService } = withSquat();
    page.onName('Leg day');

    page.save();

    expect('notes' in routineService.create.mock.calls[0][0]).toBe(false);
  });

  it('loads the note, counts a change to it, and sends a cleared one', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    const withNote = savedRoutine('r-1');
    withNote.notes = 'Heavy first';
    routineService.get.mockReturnValueOnce(of(withNote));
    page.ionViewWillEnter();
    page.edit();
    expect(page.notes()).toBe('Heavy first');
    expect(page.dirty()).toBe(false);

    page.notes.set('');
    expect(page.dirty()).toBe(true);
    page.save();

    expect(routineService.update.mock.calls[0][1]).toMatchObject({ notes: '' });
  });
});

describe('RoutineBuilder, saving and starting', () => {
  it('asks for a name rather than saving without one', () => {
    const { page, routineService } = withSquat();

    page.save();

    expect(page.nameError()).toBe(true);
    expect(routineService.create).not.toHaveBeenCalled();
    page.onName('Leg day');
    expect(page.nameError()).toBe(false);
  });

  it('saves every set as its own row', () => {
    const { page, routineService } = withSquat();
    page.onName(' Leg day ');
    const row = page.exercises()[0];
    page.editCell(row, row.sets[0], SetFields.Reps);
    page.onPadAction('5');

    page.save();

    const payload = routineService.create.mock.calls[0][0];
    expect(payload.name).toBe('Leg day');
    expect(payload.exercises?.[0].sets).toEqual([
      { setType: ExerciseSetType.Normal, targetRepsMin: 5, targetRepsMax: 5 },
      { setType: ExerciseSetType.Normal },
      { setType: ExerciseSetType.Normal },
    ]);
  });

  it('saves a new routine, then starts it in place of this page', () => {
    const { page, routineService, router } = withSquat();
    page.onName('Leg day');
    expect(page.startLabel()).toBe('workouts.routineBuilder.saveAndStart');

    page.saveAndStart();

    expect(routineService.create).toHaveBeenCalled();
    expect(routineService.start).toHaveBeenCalledWith('r-new');
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/workouts/log', 'log-1'], { replaceUrl: true });
  });

  it('starts an unchanged saved routine without saving it again', () => {
    const { page, routineService } = setup({ id: 'r-1' });
    page.ionViewWillEnter();
    page.edit();
    expect(page.startLabel()).toBe('workouts.common.startWorkout');

    page.saveAndStart();

    expect(routineService.update).not.toHaveBeenCalled();
    expect(routineService.start).toHaveBeenCalledWith('r-1');
  });

  it('offers Start while training, once there is something to start', () => {
    const { page } = setup();
    page.ionViewWillEnter();
    expect(page.showStart()).toBe(false);

    page.onPicked([squat]);
    expect(page.showStart()).toBe(true);
  });

  // Coaching, a routine is something to hand out: Save is the whole job.
  it('offers no Start while coaching', () => {
    const { page } = setup({ coach: true });
    page.ionViewWillEnter();

    expect(page.showStart()).toBe(false);
  });
});
