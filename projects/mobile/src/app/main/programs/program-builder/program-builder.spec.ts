import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Program, ProgramAssignmentService, ProgramService, ProgramWorkout } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ProgramBuilder } from './program-builder';
import { ProgramBuilderStore } from './program-builder.store';

const DRAFT_NAME = 'programs.builder.untitledProgram';

function draft(id: string): Program {
  return { id, name: DRAFT_NAME, status: 'DRAFT', workouts: [] } as unknown as Program;
}

/** Keys come back as keys, with their params when there are any, so a test can read both. */
function instant(key: string, params?: Record<string, unknown>): string {
  if (!params) {
    return key;
  }
  return `${key} ${JSON.stringify(params)}`;
}

/** A day with `exercises` exercises of `sets` sets each, 90 s of rest per set. */
function day(id: string, weekIndex: number, dayIndex: number, exercises = 1, sets = 3): ProgramWorkout {
  return {
    id,
    programId: 'p-1',
    name: id,
    weekIndex,
    dayIndex,
    estimatedDurationMinutes: null,
    exercises: Array.from({ length: exercises }, () => ({
      sets: Array.from({ length: sets }, () => ({ restAfterSeconds: 90 })),
    })),
  } as unknown as ProgramWorkout;
}

function program(workouts: ProgramWorkout[], over: Record<string, unknown> = {}): Program {
  return {
    id: 'p-1',
    name: 'Strength base',
    status: 'DRAFT',
    source: 'INSTRUCTOR',
    durationDays: 56,
    workouts,
    ...over,
  } as unknown as Program;
}

function setup(routeId: string) {
  const create = vi.fn(() => of(draft('p-new')));
  const remove = vi.fn(() => of(undefined));
  const removeWorkout = vi.fn(() => of(undefined));
  const addWorkout = vi.fn(() => of(day('new-day', 0, 0, 0)));
  const navigate = vi.fn(() => Promise.resolve(true));
  const navigateForward = vi.fn(() => Promise.resolve(true));
  const get = vi.fn(() => of(draft(routeId)));
  let closeToast: (undone: boolean) => void = () => undefined;
  const toast = {
    undone: new Promise<boolean>((resolve) => {
      closeToast = resolve;
    }),
    dismiss: vi.fn(() => {
      closeToast(false);
      return Promise.resolve();
    }),
  };
  const undoable = vi.fn(() => Promise.resolve(toast));
  const success = vi.fn(() => Promise.resolve());
  const error = vi.fn(() => Promise.resolve());
  const copyWeek = vi.fn(() => of([]));
  const insertWeekAfter = vi.fn(() => of(program([day('mon', 0, 0), day('w3', 2, 0)])));
  const clearWeek = vi.fn(() => of(program([])));
  TestBed.configureTestingModule({
    providers: [
      ProgramBuilderStore,
      {
        provide: ProgramService,
        useValue: {
          create,
          remove,
          get,
          removeWorkout,
          addWorkout,
          copyWeek,
          insertWeekAfter,
          clearWeek,
        },
      },
      { provide: ProgramAssignmentService, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: routeId }) } } },
      { provide: Router, useValue: { url: '/tabs/programs/program/' + routeId, navigate } },
      { provide: NavController, useValue: { navigateForward } },
      { provide: FeedbackService, useValue: { undoable, success, error } },
      { provide: TranslateService, useValue: { instant } },
    ],
  });
  const store = TestBed.inject(ProgramBuilderStore);
  const builder = TestBed.runInInjectionContext(() => new ProgramBuilder());
  return {
    builder,
    store,
    create,
    remove,
    removeWorkout,
    addWorkout,
    navigate,
    navigateForward,
    get,
    undoable,
    success,
    copyWeek,
    insertWeekAfter,
    clearWeek,
    toast,
    closeToast: (undone: boolean) => closeToast(undone),
  };
}

/** Lets the awaited toast calls settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('ProgramBuilder, a new program', () => {
  it('keeps the draft it just made when the page reopens under its id', () => {
    const { builder, create, remove, navigateForward } = setup('new');
    builder.ionViewWillEnter();
    expect(create).toHaveBeenCalledOnce();
    // Its real address, without a second slide in.
    expect(navigateForward).toHaveBeenCalledWith(['/tabs/programs', 'program', 'p-new'], {
      replaceUrl: true,
      animated: false,
    });

    // Ionic closes the "new" page as the id's page opens.
    builder.ionViewWillLeave();
    expect(remove).not.toHaveBeenCalled();
  });

  it('still throws away an untouched draft when the coach backs out of it', () => {
    const { builder, store, remove } = setup('p-new');
    store.adopt(draft('p-new'));
    builder.ionViewWillEnter();
    store.adopt(draft('p-new'));
    builder.ionViewWillLeave();
    expect(remove).toHaveBeenCalledWith('p-new');
  });

  it('shows the handed draft on the page under its id, without loading it again', () => {
    const first = setup('new');
    first.builder.ionViewWillEnter();
    TestBed.resetTestingModule();

    const second = setup('p-new');
    second.builder.ionViewWillEnter();
    expect(second.get).not.toHaveBeenCalled();
    expect(second.store.program()?.id).toBe('p-new');
  });
});

describe('ProgramBuilder, the publish checklist', () => {
  it('does not take the name a new draft is born with, in either language, as a name', () => {
    const { builder, store } = setup('p-1');
    for (const name of ['Untitled program', 'Program fără titlu']) {
      store.adopt(program([day('mon', 0, 0)], { name }));
      expect(builder.hasName()).toBe(false);
      expect(builder.canPublish()).toBe(false);
    }
    store.adopt(program([day('mon', 0, 0)]));
    expect(builder.hasName()).toBe(true);
    expect(builder.canPublish()).toBe(true);
  });

  it('needs a day with an exercise, not just a day', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 0, 0, 0)]));
    expect(builder.hasDayWithExercises()).toBe(false);
    expect(builder.canPublish()).toBe(false);
  });

  it('says what will be published once nothing is missing', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 0, 0), day('wed', 0, 2), day('fri', 0, 4, 0)]));
    expect(builder.publishReady()).toBe('programs.builder.publish.ready {"weeks":8,"days":2}');
  });

  it("opens the first day there is, else makes the first week's first day", () => {
    const first = setup('p-1');
    first.store.adopt(program([day('w2', 1, 0), day('tue', 0, 1)]));
    first.builder.openFirstDay();
    expect(first.navigate).toHaveBeenCalledWith(['/tabs/programs', 'program', 'p-1', 'day', 'tue']);
    TestBed.resetTestingModule();

    const empty = setup('p-1');
    empty.store.adopt(program([]));
    empty.builder.openFirstDay();
    expect(empty.addWorkout).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ weekIndex: 0, dayIndex: 0 }),
    );
    expect(empty.navigate).toHaveBeenCalledWith([
      '/tabs/programs',
      'program',
      'p-1',
      'day',
      'new-day',
    ]);
  });
});

describe('ProgramBuilder, a published program', () => {
  it('says Published with a badge, not in the subtitle; a draft keeps the word', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 0, 0)], { status: 'PUBLISHED' }));
    expect(builder.subtitle()).not.toContain('enum.programStatus');
    store.adopt(program([day('mon', 0, 0)]));
    expect(builder.subtitle()).toContain('enum.programStatus.DRAFT');
  });

  it('tells the coach when clients already follow it', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([], { status: 'PUBLISHED', clientCount: 3 }));
    expect(builder.showClientsNotice()).toBe(true);
    expect(builder.clientsNotice()).toBe('programs.builder.clientsNotice {"count":3}');

    store.adopt(program([], { status: 'PUBLISHED', clientCount: 0 }));
    expect(builder.showClientsNotice()).toBe(false);
    store.adopt(program([], { status: 'DRAFT', clientCount: 3 }));
    expect(builder.showClientsNotice()).toBe(false);
    // A starter cannot be edited here, so there is no edit to warn about.
    store.adopt(program([], { status: 'PUBLISHED', clientCount: 3, source: 'SYSTEM' }));
    expect(builder.showClientsNotice()).toBe(false);
  });

  it('says what each day holds and about how long it takes', () => {
    const { builder } = setup('p-1');
    // 2 exercises × 3 sets × (45 + 90) s = 13.5 min, so ~15.
    expect(builder.dayMeta(day('mon', 0, 0, 2, 3))).toBe(
      'programs.builder.dayMeta {"count":2,"minutes":15}',
    );
    expect(builder.dayMeta(day('tue', 0, 1, 1, 0))).toBe('count.exercises {"count":1}');
    expect(builder.dayMeta(day('wed', 0, 2, 0))).toBe('programs.builder.dayEmpty');
  });
});

describe('ProgramBuilder, clearing a day', () => {
  it('offers to undo it, and undo brings it back with no delete sent', async () => {
    const { builder, store, undoable, removeWorkout, closeToast } = setup('p-1');
    const monday = day('mon', 0, 0);
    store.adopt(program([monday]));

    // No confirm first: the X clears it, and the toast offers Undo.
    builder.clearDay(monday, new Event('click'));
    await settle();

    expect(store.workouts()).toEqual([]);
    expect(undoable).toHaveBeenCalledWith(
      expect.stringContaining('programs.builder.toast.dayCleared'),
      'button.undo',
    );
    closeToast(true);
    await settle();
    expect(store.workouts().map((w) => w.id)).toEqual(['mon']);
    expect(removeWorkout).not.toHaveBeenCalled();
  });

  it('deletes it for real once the toast runs out', async () => {
    const { builder, store, removeWorkout, closeToast } = setup('p-1');
    const monday = day('mon', 0, 0);
    store.adopt(program([monday]));

    builder.clearDay(monday, new Event('click'));
    await settle();
    closeToast(false);
    await settle();

    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');
  });

  it('deletes it and closes the toast when the page is left', async () => {
    const { builder, store, removeWorkout, toast } = setup('p-1');
    const monday = day('mon', 0, 0);
    store.adopt(program([monday]));
    builder.clearDay(monday, new Event('click'));
    await settle();

    builder.ionViewWillLeave();
    await settle();

    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');
    expect(toast.dismiss).toHaveBeenCalled();
  });
});

describe('ProgramBuilder, the footer', () => {
  it('asks a draft to publish, and a published program to be assigned', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 0, 0)]));
    expect(builder.showPublishFooter()).toBe(true);
    expect(builder.showAssignFooter()).toBe(false);

    store.adopt(program([day('mon', 0, 0)], { status: 'PUBLISHED' }));
    expect(builder.showPublishFooter()).toBe(false);
    expect(builder.showAssignFooter()).toBe(true);
    builder.openAssign();
    expect(builder.assignOpen()).toBe(true);
  });

  it("gives a published starter Assign too, and a starter's draft nothing", () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([], { status: 'PUBLISHED', source: 'SYSTEM' }));
    expect(builder.showAssignFooter()).toBe(true);
    store.adopt(program([], { status: 'DRAFT', source: 'SYSTEM' }));
    expect(builder.showFooter()).toBe(false);
  });
});

describe("ProgramBuilder, a week's menu", () => {
  it('offers the four verbs for a week with days, and says how many hold exercises', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 1, 0), day('wed', 1, 2), day('fri', 1, 4, 0)]));
    builder.openWeekMenu(1);

    expect(builder.weekMenuOpen()).toBe(true);
    expect(builder.weekMenuActions().map((action) => action.id)).toEqual([
      'copy',
      'insertAfter',
      'clear',
      'delete',
    ]);
    expect(builder.weekMenuSubtitle()).toBe('programs.builder.weekMenu.subtitle {"count":2}');
  });

  it('copies to every week picked in one request', () => {
    const { builder, store, copyWeek } = setup('p-1');
    store.adopt(program([day('mon', 0, 0)]));
    builder.openCopy(0);

    builder.onCopy([1, 2, 3]);

    expect(copyWeek).toHaveBeenCalledOnce();
    expect(copyWeek).toHaveBeenCalledWith('p-1', 0, [1, 2, 3]);
  });

  it('adds a week after one, and the weeks after it keep their open state', () => {
    const { builder, store, insertWeekAfter, success } = setup('p-1');
    store.adopt(program([day('mon', 0, 0), day('w2', 1, 0)]));
    builder.openWeeks.set(new Set([0, 1]));

    builder.openWeekMenu(0);
    builder.onWeekAction('insertAfter');

    expect(insertWeekAfter).toHaveBeenCalledWith('p-1', 0);
    // Week 2 moved to week 3; the new week 2 opens.
    expect([...builder.openWeeks()].sort()).toEqual([0, 1, 2]);
    expect(store.workouts().map((w) => w.id)).toEqual(['mon', 'w3']);
    expect(success).toHaveBeenCalledWith(
      'programs.builder.toast.weekAdded {"week":2,"after":1}',
    );
  });

  it('clears a week in one request, after a red confirm listing its days', () => {
    const { builder, store, clearWeek } = setup('p-1');
    store.adopt(program([day('mon', 1, 0), day('wed', 1, 2)], { clientCount: 3 }));
    builder.openWeekMenu(1);
    builder.onWeekAction('clear');

    expect(builder.clearWeekOpen()).toBe(true);
    expect(builder.clearWeekFacts().map((fact) => fact.value)).toEqual(['mon', 'wed']);
    expect(builder.clearWeekBody()).toContain('programs.builder.weekMenu.clientsKeepCopy {"count":3}');

    builder.confirmClearWeek();
    expect(clearWeek).toHaveBeenCalledOnce();
    expect(clearWeek).toHaveBeenCalledWith('p-1', 1);
  });

  it('says what deleting a week does to the weeks after it, and that clients keep their copy', () => {
    const { builder, store } = setup('p-1');
    // 8 weeks; deleting week 2.
    store.adopt(program([day('mon', 1, 0)], { clientCount: 3 }));
    builder.openWeekMenu(1);
    builder.onWeekAction('delete');

    expect(builder.deleteWeekOpen()).toBe(true);
    expect(builder.deleteWeekTitle()).toBe('programs.builder.deleteWeek.title {"week":2}');
    expect(builder.deleteWeekBody()).toContain('programs.builder.weekMenu.clientsKeepCopy');
    expect(builder.deleteWeekFacts()).toHaveLength(1);
    // Core's translate() speaks English in tests.
    expect(builder.deleteWeekShift()).toBe(
      'Weeks 3 to 8 move up and become weeks 2 to 7. The program ends up with 7 weeks.',
    );
  });

  it('leaves the clients sentence out when nobody follows the program', () => {
    const { builder, store } = setup('p-1');
    store.adopt(program([day('mon', 1, 0)], { clientCount: 0 }));
    builder.openWeekMenu(1);
    expect(builder.deleteWeekBody()).not.toContain('clientsKeepCopy');
  });
});
