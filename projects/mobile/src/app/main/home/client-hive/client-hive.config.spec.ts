/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  ProgramAssignment,
  ProgramAssignmentStatus,
  RosterClient,
  WorkoutLog,
  WorkoutLogStatus,
} from 'core';

import { BoardLooks, BoardRings } from '../_components/hive-board/hive-board.config';
import {
  CLIENT_HIVE_ICONS,
  ClientActions,
  ClientStatusKinds,
  HiveFilters,
  WeekDayStates,
  clientActions,
  clientHiveCells,
  clientStatus,
  clientWeek,
  endingPlanOf,
  filterClients,
  ghostHiveCells,
  hiveTotals,
  isQuiet,
  lastWorkoutRow,
  movedCount,
  orderedClients,
  planEndsText,
  plannedInWeek,
  rangeFrom,
  statusText,
  trainedIn,
  weekStripCells,
  weekSummaryText,
  weekWindow,
} from './client-hive.config';

/** The page, its sheet and their parts. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The sheet's actions name their glyphs in the config. */
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

/** Echoes the key and its params, so a test reads what would be said. */
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

function client(overrides: Partial<RosterClient> = {}): RosterClient {
  return {
    clientId: 'c1',
    name: 'Anna Popescu',
    avatarUrl: null,
    handle: null,
    due: 0,
    completed: 0,
    skipped: 0,
    adherencePercent: null,
    previousAdherencePercent: null,
    lastWorkoutAt: null,
    daysSinceLastWorkout: 2,
    activePlans: 1,
    attention: null,
    ...overrides,
  };
}

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'l1',
    userId: 'u1',
    programAssignmentId: null,
    assignedWorkoutId: null,
    name: 'Upper body',
    status: WorkoutLogStatus.Completed,
    startedAt: new Date(2026, 9, 27, 18, 0).toISOString(),
    completedAt: new Date(2026, 9, 27, 19, 0).toISOString(),
    durationSeconds: 3000,
    feelingRating: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/** A skipped plan day, as the timeline sends it: noon UTC on its date. */
function skip(id: string, startedAt: string): WorkoutLog {
  return log({ id, status: WorkoutLogStatus.Skipped, startedAt, completedAt: null });
}

function plan(overrides: Partial<ProgramAssignment> = {}): ProgramAssignment {
  return {
    id: 'p1',
    instructorId: 'coach',
    clientId: 'c1',
    instructorClientId: null,
    masterProgramId: null,
    programNameSnapshot: 'Strength block',
    status: ProgramAssignmentStatus.Active,
    startDate: '2026-10-01',
    endDate: null,
    completionPercent: 40,
    notes: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...overrides,
  };
}

const coach = { id: 'coach', name: 'Alex Rivera', avatarUrl: null };
const copy = { t, range: '1w' as const, tone: () => 'teal' };

describe('CLIENT_HIVE_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon the page and its sheet render, and nothing else', () => {
    const used = iconNamesUsed();
    const registered = new Set(Object.keys(CLIENT_HIVE_ICONS));
    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(name);
    }
    for (const name of registered) {
      expect(used, `${name} is registered but unused`).toContain(name);
    }
  });
});

describe('rangeFrom', () => {
  it('takes the two roster windows and nothing else', () => {
    expect(rangeFrom('1w')).toBe('1w');
    expect(rangeFrom('4w')).toBe('4w');
    expect(rangeFrom('2w')).toBeNull();
    expect(rangeFrom(undefined)).toBeNull();
  });
});

describe('who trained', () => {
  it('calls a week or more without a workout quiet, never a client who never trained', () => {
    expect(isQuiet(client({ daysSinceLastWorkout: 7 }))).toBe(true);
    expect(isQuiet(client({ daysSinceLastWorkout: 6 }))).toBe(false);
    expect(isQuiet(client({ daysSinceLastWorkout: null }))).toBe(false);
  });

  // Both windows roll: 7 days and 28 days back from today.
  it('counts a client as trained inside the range', () => {
    const tenDays = client({ daysSinceLastWorkout: 10 });
    expect(trainedIn(tenDays, '1w')).toBe(false);
    expect(trainedIn(tenDays, '4w')).toBe(true);
    expect(trainedIn(client({ daysSinceLastWorkout: null }), '4w')).toBe(false);
    expect(movedCount([client(), tenDays, client({ daysSinceLastWorkout: null })], '4w')).toBe(2);
  });
});

describe('filterClients', () => {
  it('keeps the clients the roster flags under Need attention', () => {
    const flagged = client({ clientId: 'c2', attention: 'NO_PLAN' });
    expect(filterClients([client(), flagged], HiveFilters.Attention)).toEqual([flagged]);
    expect(filterClients([client(), flagged], HiveFilters.All)).toHaveLength(2);
  });
});

describe('orderedClients', () => {
  // The most honey sits in the inner ring; the quiet ones go last.
  it('puts the fullest cells first and the quiet ones last', () => {
    const done = client({ clientId: 'done', due: 2, completed: 2 });
    const half = client({ clientId: 'half', due: 4, completed: 2 });
    const none = client({ clientId: 'none', due: 3, completed: 0 });
    const noPlan = client({ clientId: 'noPlan', activePlans: 0 });
    const never = client({ clientId: 'never', daysSinceLastWorkout: null, activePlans: 0 });
    const quiet = client({ clientId: 'quiet', due: 2, completed: 2, daysSinceLastWorkout: 9 });
    expect(
      orderedClients([quiet, never, noPlan, none, half, done]).map((one) => one.clientId),
    ).toEqual(['done', 'half', 'none', 'noPlan', 'never', 'quiet']);
  });
});

describe('clientStatus', () => {
  it('says the most pressing thing first', () => {
    expect(clientStatus(client({ daysSinceLastWorkout: 9, due: 3, completed: 1 }))).toEqual({
      kind: ClientStatusKinds.Quiet,
      days: 9,
    });
    expect(clientStatus(client({ daysSinceLastWorkout: null, due: 3 }))).toEqual({
      kind: ClientStatusKinds.NotStarted,
    });
    expect(clientStatus(client({ due: 5, completed: 4 }))).toEqual({
      kind: ClientStatusKinds.Plan,
      completed: 4,
      due: 5,
    });
    expect(clientStatus(client({ due: 0 }))).toEqual({ kind: ClientStatusKinds.NoPlan });
  });

  it('words the plan for the range on screen', () => {
    const status = clientStatus(client({ due: 5, completed: 4 }));
    expect(statusText(status, '1w', t)).toBe(
      'clientHive.status.plan.1w {"completed":4,"due":5}',
    );
    expect(statusText(status, '4w', t)).toBe(
      'clientHive.status.plan.4w {"completed":4,"due":5}',
    );
  });
});

describe('clientHiveCells', () => {
  it('puts the coach in the middle and a client in each cell around them', () => {
    const cells = clientHiveCells(coach, [client()], copy);
    expect(cells).toHaveLength(7);
    expect(cells[0]).toMatchObject({
      key: 'centre',
      look: BoardLooks.Bare,
      ring: BoardRings.Centre,
      name: null,
      avatar: { name: 'Alex Rivera', imageUrl: null, tone: 'teal' },
    });
    expect(cells[1]!.key).toBe('c1');
    // The rest of the ring is empty, and nothing to tap.
    expect(cells.slice(2).every((cell) => cell.look === BoardLooks.Ghost && !cell.name)).toBe(
      true,
    );
  });

  it('fills a client by their plan, dashes no plan and rings a quiet week', () => {
    const [, half, noPlan, quiet] = clientHiveCells(
      coach,
      [
        client({ clientId: 'half', due: 4, completed: 2 }),
        client({ clientId: 'noPlan', due: 0, activePlans: 0 }),
        client({ clientId: 'quiet', due: 2, completed: 0, daysSinceLastWorkout: 8 }),
      ],
      copy,
    );
    expect(half).toMatchObject({ look: BoardLooks.Solid, fill: 0.5, ring: null });
    expect(noPlan).toMatchObject({ look: BoardLooks.Dashed, fill: 0 });
    expect(quiet).toMatchObject({ look: BoardLooks.Solid, fill: 0, ring: BoardRings.Quiet });
  });

  it('names each client cell with who and how it went, and keeps the photo', () => {
    const anna = client({ due: 5, completed: 4, avatarUrl: 'https://img/anna.jpg' });
    const [, cell] = clientHiveCells(coach, [anna], copy);
    const status = statusText(clientStatus(anna), '1w', t);
    expect(cell!.name).toBe(t('clientHive.cell', { name: 'Anna Popescu', status }));
    expect(cell!.avatar).toEqual({
      name: 'Anna Popescu',
      imageUrl: 'https://img/anna.jpg',
      tone: 'teal',
    });
  });

  it('grows a ring for every eighteen more', () => {
    const many = Array.from({ length: 20 }, (_, i) => client({ clientId: `c${i}` }));
    const cells = clientHiveCells(coach, many, copy);
    expect(cells).toHaveLength(37);
    expect(cells.filter((cell) => cell.name)).toHaveLength(20);
  });
});

describe('ghostHiveCells', () => {
  it('is the coach and two rings of empty cells', () => {
    const cells = ghostHiveCells();
    expect(cells).toHaveLength(19);
    expect(cells.every((cell) => cell.look === BoardLooks.Ghost && !cell.name)).toBe(true);
  });
});

describe('hiveTotals', () => {
  const totals = {
    clients: 3,
    needsAttention: 1,
    adherencePercent: 34.4,
    workouts: 5,
    previousWorkouts: 2,
    records: 1,
  };

  it('adds up the workouts beside the range before, the records and the plan', () => {
    expect(hiveTotals(totals, t)).toEqual([
      {
        key: 'workouts',
        label: 'clientHive.totals.workouts',
        value: '5',
        hint: 'clientHive.totals.before {"count":2}',
      },
      { key: 'records', label: 'clientHive.totals.records', value: '1', hint: null },
      {
        key: 'plan',
        label: 'clientHive.totals.plan',
        value: 'clientHive.totals.percent {"percent":34}',
        hint: null,
      },
    ]);
  });

  // Nothing due anywhere is no percentage, not 0%.
  it('leaves the plan out when nothing was due', () => {
    expect(
      hiveTotals({ ...totals, adherencePercent: null }, t).map((tile) => tile.key),
    ).toEqual(['workouts', 'records']);
  });
});

describe('clientWeek', () => {
  // Thursday 29 October 2026: the week runs Monday 26 to Sunday 1 November.
  const today = new Date(2026, 9, 29, 10, 0);

  it('reads the week Monday to Sunday, today marked', () => {
    const week = clientWeek(today, [], []);
    expect(week.map((day) => day.key)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(week.filter((day) => day.isToday).map((day) => day.key)).toEqual(['2026-10-29']);
    expect(week.every((day) => day.state === WeekDayStates.None)).toBe(true);
  });

  it('marks trained, skipped and planned days, trained winning over the rest', () => {
    const week = clientWeek(
      today,
      [
        log(),
        skip('s', '2026-10-28T12:00:00.000Z'),
        skip('s2', '2026-10-27T12:00:00.000Z'),
      ],
      [
        { scheduledDate: '2026-10-30', status: null },
        { scheduledDate: '2026-10-31', status: WorkoutLogStatus.Skipped },
        { scheduledDate: '2026-10-27', status: null },
      ],
    );
    expect(week.map((day) => day.state)).toEqual([
      WeekDayStates.None,
      WeekDayStates.Trained,
      WeekDayStates.Skipped,
      WeekDayStates.None,
      WeekDayStates.Planned,
      WeekDayStates.Skipped,
      WeekDayStates.None,
    ]);
  });

  it('draws trained as honey, planned as a waiting cell, skipped dashed, nothing a ghost', () => {
    const cells = weekStripCells([
      { key: 'a', state: WeekDayStates.Trained, isToday: false },
      { key: 'b', state: WeekDayStates.Planned, isToday: true },
      { key: 'c', state: WeekDayStates.Skipped, isToday: false },
      { key: 'd', state: WeekDayStates.None, isToday: false },
    ]);
    expect(cells.map((cell) => [cell.look, cell.fill, cell.ring])).toEqual([
      [BoardLooks.Solid, 1, null],
      [BoardLooks.Solid, 0, BoardRings.Today],
      [BoardLooks.Dashed, 0, null],
      [BoardLooks.Ghost, 0, null],
    ]);
    expect(cells.every((cell) => !cell.name)).toBe(true);
  });

  it('sums the week up for a screen reader', () => {
    const text = weekSummaryText(
      [
        { key: 'a', state: WeekDayStates.Trained, isToday: false },
        { key: 'b', state: WeekDayStates.Trained, isToday: false },
        { key: 'c', state: WeekDayStates.Skipped, isToday: false },
      ],
      t,
    );
    expect(text).toBe('clientHive.sheet.weekA11y {"trained":2,"planned":0,"skipped":1}');
  });

  it('keeps the plans’ days inside the week', () => {
    const window = weekWindow(today);
    const tree = plan({
      workouts: [
        { scheduledDate: '2026-10-25', status: null },
        { scheduledDate: '2026-10-26', status: WorkoutLogStatus.Completed },
        { scheduledDate: '2026-11-01', status: null },
        { scheduledDate: '2026-11-02', status: null },
      ].map((workout, i) => ({
        id: `w${i}`,
        programAssignmentId: 'p1',
        masterWorkoutId: null,
        sequenceNumber: i,
        name: 'Day',
        notes: null,
        weekIndex: 0,
        dayIndex: i,
        phase: null,
        estimatedDurationMinutes: null,
        ...workout,
      })),
    });
    expect(plannedInWeek([tree], window)).toEqual([
      { scheduledDate: '2026-10-26', status: WorkoutLogStatus.Completed },
      { scheduledDate: '2026-11-01', status: null },
    ]);
  });
});

describe('lastWorkoutRow', () => {
  const rowCopy = { t, time: () => '2d', duration: (seconds: number) => `${seconds / 60}m` };

  it('says when, how long and the records', () => {
    expect(lastWorkoutRow(log({ prCount: 2 }), rowCopy)).toEqual({
      id: 'l1',
      title: 'Upper body',
      detail: '2d · 50m · clientHive.sheet.records {"count":2}',
      record: true,
    });
  });

  // An unknown length is left out, never shown as 0 or six days.
  it('leaves out what it does not know', () => {
    expect(lastWorkoutRow(log({ durationSeconds: 9 * 3600 }), rowCopy).detail).toBe('2d');
  });
});

describe('clientActions', () => {
  it('offers to assign a plan, in honey, when there is none', () => {
    expect(clientActions(client({ activePlans: 0 }), false, t)).toEqual([
      {
        id: ClientActions.Message,
        label: 'clientHive.sheet.actions.message',
        icon: 'chatbubble-outline',
        main: false,
      },
      {
        id: ClientActions.Assign,
        label: 'clientHive.sheet.actions.assign',
        icon: 'add-outline',
        main: true,
      },
      {
        id: ClientActions.Profile,
        label: 'clientHive.sheet.actions.profile',
        icon: 'person-outline',
        main: false,
      },
    ]);
  });

  it('offers the plan when it ends soon', () => {
    const actions = clientActions(client(), true, t);
    expect(actions.map((action) => [action.id, action.main])).toEqual([
      [ClientActions.Message, false],
      [ClientActions.OpenPlan, true],
      [ClientActions.Profile, false],
    ]);
  });

  it('makes Message the honey one when nothing else fits', () => {
    const actions = clientActions(client(), false, t);
    expect(actions.map((action) => [action.id, action.main])).toEqual([
      [ClientActions.Message, true],
      [ClientActions.Profile, false],
    ]);
  });
});

describe('the plan ending soon', () => {
  it('finds the client’s active plan that ends within the week', () => {
    const plans = [
      plan({ id: 'later', endDate: '2026-11-20' }),
      plan({ id: 'soon', endDate: '2026-10-31' }),
      plan({ id: 'other', clientId: 'c2', endDate: '2026-10-30' }),
    ];
    expect(endingPlanOf('c1', plans, '2026-10-29')?.id).toBe('soon');
    expect(endingPlanOf('c3', plans, '2026-10-29')).toBeNull();
  });

  it('says when it ends: today, tomorrow or the weekday', () => {
    const ends = (endDate: string) =>
      planEndsText(plan({ endDate }), '2026-10-29', 'en-GB', t);
    expect(ends('2026-10-29')).toBe(
      'clientHive.sheet.planEnds {"plan":"Strength block","when":"clientHive.sheet.when.today"}',
    );
    expect(ends('2026-10-30')).toBe(
      'clientHive.sheet.planEnds {"plan":"Strength block","when":"clientHive.sheet.when.tomorrow"}',
    );
    expect(ends('2026-11-01')).toBe(
      'clientHive.sheet.planEnds {"plan":"Strength block","when":"Sunday"}',
    );
  });
});
