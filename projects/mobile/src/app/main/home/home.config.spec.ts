/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  CoachActivityItem,
  Post,
  ProgramAssignment,
  ProgressRecord,
  RosterClient,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogStatus,
} from 'core';

import {
  COACH_SHORTCUTS,
  ClientHiveStates,
  EndDays,
  GreetingPeriods,
  HIVE_BUILD,
  HiveCellKinds,
  HiveFills,
  HiveRings,
  LatestCopy,
  LatestKinds,
  LoadStates,
  NeedActions,
  NeedCopy,
  NeedItem,
  NeedReasons,
  RING_ONE_SIZE,
  RINGS_SIZE,
  SLOW_LOAD_MS,
  ShortcutIds,
  WeekLineKinds,
  WeekSummary,
  buildFrames,
  buildingCells,
  clientFill,
  clientHiveState,
  coachHiveCells,
  coachLatest,
  coachShortcuts,
  dayGroups,
  endDay,
  firstNameOf,
  greetingPeriod,
  initialsOf,
  isBuilding,
  knownDuration,
  latestCapped,
  latestPreview,
  latestRow,
  loadState,
  movedCount,
  needGroups,
  needItems,
  needPreview,
  needRow,
  plansEndingSoon,
  ringPlaces,
  traineeLatest,
  weekCells,
  weekDays,
  weekLine,
  weekPlaces,
  weekSummary,
  withinDays,
} from './home.config';

function client(overrides: Partial<RosterClient> = {}): RosterClient {
  return {
    clientId: overrides.clientId ?? 'c1',
    name: 'Anna Popescu',
    avatarUrl: null,
    handle: null,
    due: 0,
    completed: 0,
    skipped: 0,
    adherencePercent: null,
    previousAdherencePercent: null,
    lastWorkoutAt: null,
    daysSinceLastWorkout: null,
    activePlans: 1,
    attention: null,
    ...overrides,
  };
}

function log(
  completedAt: string,
  prCount = 0,
  status: WorkoutLog['status'] = WorkoutLogStatus.Completed,
): WorkoutLog {
  return { id: completedAt, startedAt: completedAt, completedAt, status, prCount } as WorkoutLog;
}

function planDay(scheduledDate: string, status: TrainingDayWorkout['status'] = null): TrainingDayWorkout {
  return { assignedWorkoutId: scheduledDate, scheduledDate, status } as TrainingDayWorkout;
}

function plan(endDate: string | null, status = 'ACTIVE', clientId = 'c1'): ProgramAssignment {
  return {
    id: endDate ?? 'open',
    endDate,
    status,
    clientId,
    programNameSnapshot: 'Strength Base',
    completionPercent: 58,
    client: { id: clientId, firstName: 'Anna', lastName: 'Popescu', avatarUrl: null },
  } as ProgramAssignment;
}

/** Echoes the key and its params, so a test reads which message was picked. */
const echo = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

/** Saturday 31 October 2026, mid-morning, local time. */
const SATURDAY = new Date(2026, 9, 31, 10, 0);

describe('greetingPeriod', () => {
  it('says morning from 5, afternoon from 12, evening from 18 until 5', () => {
    expect(greetingPeriod(new Date(2026, 0, 1, 4, 59))).toBe(GreetingPeriods.Evening);
    expect(greetingPeriod(new Date(2026, 0, 1, 5, 0))).toBe(GreetingPeriods.Morning);
    expect(greetingPeriod(new Date(2026, 0, 1, 11, 59))).toBe(GreetingPeriods.Morning);
    expect(greetingPeriod(new Date(2026, 0, 1, 12, 0))).toBe(GreetingPeriods.Afternoon);
    expect(greetingPeriod(new Date(2026, 0, 1, 18, 0))).toBe(GreetingPeriods.Evening);
  });
});

describe('firstNameOf', () => {
  it('takes the first word', () => {
    expect(firstNameOf('  Anna Maria Popescu ')).toBe('Anna');
    expect(firstNameOf('Cher')).toBe('Cher');
  });
});

describe('initialsOf', () => {
  it('takes the first and last names, or one letter for one name', () => {
    expect(initialsOf('anna maria popescu')).toBe('AP');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('  ')).toBe('');
  });
});

describe('honeycomb geometry', () => {
  const distinct = (places: { x: number; y: number }[]) =>
    new Set(places.map((p) => `${p.x},${p.y}`)).size;

  it('puts one ring around the centre while six cells hold everyone', () => {
    const places = ringPlaces(RING_ONE_SIZE);
    expect(places).toHaveLength(1 + RING_ONE_SIZE);
    expect(distinct(places)).toBe(places.length);

    // Every cell of the ring is the same distance from the centre.
    const [centre, ...ring] = places;
    const distances = ring.map((p) => Math.hypot(p.x - centre!.x, p.y - centre!.y));
    for (const distance of distances) expect(distance).toBeCloseTo(distances[0]!, 2);
  });

  it('opens the second ring for the seventh person', () => {
    const places = ringPlaces(RING_ONE_SIZE + 1);
    expect(places).toHaveLength(1 + RINGS_SIZE);
    expect(distinct(places)).toBe(places.length);
  });

  it('starts every grid at the top-left corner', () => {
    for (const places of [ringPlaces(3), ringPlaces(10), weekPlaces()]) {
      expect(Math.min(...places.map((p) => p.x))).toBe(0);
      expect(Math.min(...places.map((p) => p.y))).toBe(0);
    }
  });

  it('lays the week out in rows of two, three and two, read like text', () => {
    const places = weekPlaces();
    expect(places).toHaveLength(7);
    expect(distinct(places)).toBe(7);
    const rows = [...new Set(places.map((p) => p.y))];
    expect(rows).toHaveLength(3);
    expect(places.map((p) => rows.indexOf(p.y))).toEqual([0, 0, 1, 1, 1, 2, 2]);
    // Left to right inside each row.
    expect(places[0]!.x).toBeLessThan(places[1]!.x);
    expect(places[2]!.x).toBeLessThan(places[3]!.x);
    expect(places[3]!.x).toBeLessThan(places[4]!.x);
    expect(places[5]!.x).toBeLessThan(places[6]!.x);
  });

  it('lays two rings out in rows of three, four, five, four and three', () => {
    const places = ringPlaces(RINGS_SIZE);
    const counts = new Map<number, number>();
    for (const p of places) counts.set(p.y, (counts.get(p.y) ?? 0) + 1);
    expect([...counts.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)).toEqual([3, 4, 5, 4, 3]);
  });
});

describe('loadState', () => {
  const facts = { shown: false, loading: false, failed: false, slow: false };

  it('builds while nothing has arrived, and says so once the load is slow', () => {
    expect(loadState({ ...facts, loading: true })).toBe(LoadStates.First);
    expect(loadState({ ...facts, loading: true, slow: true })).toBe(LoadStates.Slow);
    // Before the first read has even started.
    expect(loadState(facts)).toBe(LoadStates.First);
  });

  it('keeps shown data on screen through a reload, a slow one, and a failed one', () => {
    expect(loadState({ ...facts, shown: true, loading: true })).toBe(LoadStates.Shown);
    expect(loadState({ ...facts, shown: true, loading: true, slow: true })).toBe(LoadStates.Shown);
    expect(loadState({ ...facts, shown: true, failed: true })).toBe(LoadStates.Shown);
  });

  it('fails only with nothing to show, and builds again while a retry runs', () => {
    expect(loadState({ ...facts, failed: true })).toBe(LoadStates.Failed);
    expect(loadState({ ...facts, failed: true, slow: true })).toBe(LoadStates.Failed);
    expect(loadState({ ...facts, failed: true, loading: true })).toBe(LoadStates.First);
  });

  it('counts first and slow as building, never failed or shown', () => {
    expect(isBuilding(LoadStates.First)).toBe(true);
    expect(isBuilding(LoadStates.Slow)).toBe(true);
    expect(isBuilding(LoadStates.Failed)).toBe(false);
    expect(isBuilding(LoadStates.Shown)).toBe(false);
  });

  it('waits eight seconds before calling a load slow', () => {
    expect(SLOW_LOAD_MS).toBe(8000);
  });
});

describe('the building comb', () => {
  it('builds the one-ring comb, the centre first, every cell empty', () => {
    const cells = buildingCells();
    expect(cells).toHaveLength(1 + RING_ONE_SIZE);
    expect(cells.every((cell) => cell.kind === HiveCellKinds.Ghost && !cell.fill && !cell.label)).toBe(true);
    expect(new Set(cells.map((cell) => cell.key)).size).toBe(cells.length);

    // The week's footprint, so the trainee's card does not change size when it lands.
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    expect(new Set(cells.map(key))).toEqual(new Set(weekPlaces().map(key)));

    // The first cell is the centre: the same distance from every other.
    const [centre, ...ring] = cells;
    const distances = ring.map((p) => Math.hypot(p.x - centre!.x, p.y - centre!.y));
    for (const distance of distances) expect(distance).toBeCloseTo(distances[0]!, 2);
  });

  it('lights the cells one after another, each a step after the last', () => {
    const starts = buildingCells().map((_, i) => buildFrames(i)[1]!.offset);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeCloseTo(HIVE_BUILD.stepMs / HIVE_BUILD.loopMs, 3);
    }
  });

  it('has the whole comb lit before it goes out, and puts it out as one', () => {
    const frames = buildingCells().map((_, i) => buildFrames(i));
    const fadeAt = HIVE_BUILD.fadeAtMs / HIVE_BUILD.loopMs;
    for (const cell of frames) {
      expect(cell[2]!.level).toBe(1);
      expect(cell[2]!.offset).toBeLessThan(fadeAt);
      expect(cell[3]).toEqual({ offset: fadeAt, level: 1 });
      expect(cell[4]!.level).toBe(0);
    }
    expect(new Set(frames.map((cell) => cell[4]!.offset)).size).toBe(1);
  });

  it('writes keyframes the browser takes: in order, from 0 to 1, out at both ends', () => {
    for (let i = 0; i < 12; i++) {
      const frames = buildFrames(i);
      expect(frames[0]).toEqual({ offset: 0, level: 0 });
      expect(frames[frames.length - 1]).toEqual({ offset: 1, level: 0 });
      for (let f = 1; f < frames.length; f++) {
        expect(frames[f]!.offset).toBeGreaterThanOrEqual(frames[f - 1]!.offset);
        expect(frames[f]!.offset).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leaves a rest after going out before the next loop', () => {
    expect(HIVE_BUILD.fadeAtMs + HIVE_BUILD.fadeMs).toBeLessThan(HIVE_BUILD.loopMs);
  });
});

describe('coachShortcuts', () => {
  const ids = (onScreen: { invite: boolean; program: boolean }) =>
    coachShortcuts(onScreen).map((shortcut) => shortcut.id);

  it('offers a new program, an invite and a new exercise, in that order', () => {
    expect(ids({ invite: false, program: false })).toEqual([
      ShortcutIds.Program,
      ShortcutIds.Invite,
      ShortcutIds.Exercise,
    ]);
    for (const shortcut of COACH_SHORTCUTS) expect(shortcut.label).toMatch(/^home\.coach\.shortcuts\./);
  });

  it('leaves out what the first week already offers above them', () => {
    expect(ids({ invite: true, program: false })).toEqual([ShortcutIds.Program, ShortcutIds.Exercise]);
    expect(ids({ invite: true, program: true })).toEqual([ShortcutIds.Exercise]);
  });
});

describe('clientHiveState', () => {
  it('is done when every planned workout of the window is', () => {
    expect(clientHiveState(client({ due: 3, completed: 3, daysSinceLastWorkout: 0 }))).toBe(
      ClientHiveStates.Done,
    );
  });

  it('is trained for any workout in the last 7 days, planned or not', () => {
    expect(clientHiveState(client({ due: 3, completed: 1, daysSinceLastWorkout: 2 }))).toBe(
      ClientHiveStates.Trained,
    );
    expect(clientHiveState(client({ due: 0, daysSinceLastWorkout: 6 }))).toBe(ClientHiveStates.Trained);
  });

  it('is quiet from the seventh day, and not started with nothing ever logged', () => {
    expect(clientHiveState(client({ daysSinceLastWorkout: 7 }))).toBe(ClientHiveStates.Quiet);
    expect(clientHiveState(client({ due: 3 }))).toBe(ClientHiveStates.NotStarted);
  });
});

describe('clientFill', () => {
  it('pours full honey for done, pale for trained, none for the rest', () => {
    expect(clientFill(client({ due: 2, completed: 2, daysSinceLastWorkout: 0 }))).toBe(HiveFills.Honey);
    expect(clientFill(client({ due: 3, completed: 2, daysSinceLastWorkout: 1 }))).toBe(HiveFills.Pale);
    expect(clientFill(client({ due: 0, daysSinceLastWorkout: 1 }))).toBe(HiveFills.Pale);
    expect(clientFill(client({ daysSinceLastWorkout: 9 }))).toBeNull();
    expect(clientFill(client())).toBeNull();
  });
});

describe('coachHiveCells', () => {
  it('puts the coach in the middle and the honey first around them', () => {
    const cells = coachHiveCells('Alex Rivera', [
      client({ clientId: 'quiet', name: 'Radu T', daysSinceLastWorkout: 9 }),
      client({ clientId: 'done', name: 'Elena D', due: 2, completed: 2, daysSinceLastWorkout: 1 }),
      client({ clientId: 'new', name: 'Nicu K' }),
    ]);

    expect(cells).toHaveLength(1 + RING_ONE_SIZE);
    expect(cells[0]).toMatchObject({ kind: HiveCellKinds.Centre, label: 'AR' });
    expect(cells.slice(1, 4).map((c) => c.key)).toEqual(['done', 'new', 'quiet']);
    expect(cells[1]!.fill).toBe(HiveFills.Honey);
    expect(cells[3]!.ring).toBe(HiveRings.Quiet);
    expect(cells.slice(4).every((c) => c.kind === HiveCellKinds.Ghost)).toBe(true);
  });

  it('shows the centre and an empty ring for a coach with no clients', () => {
    const cells = coachHiveCells('Alex', []);
    expect(cells).toHaveLength(1 + RING_ONE_SIZE);
    expect(cells.slice(1).every((c) => c.kind === HiveCellKinds.Ghost)).toBe(true);
  });

  it('counts the people two rings cannot hold in the last cell', () => {
    const many = Array.from({ length: RINGS_SIZE + 3 }, (_, i) => client({ clientId: `c${i}` }));
    const cells = coachHiveCells('Alex', many);
    expect(cells).toHaveLength(1 + RINGS_SIZE);
    expect(cells[cells.length - 1]).toMatchObject({ kind: HiveCellKinds.More, label: '+4' });
  });

  it('fills both rings exactly with eighteen and no "+"', () => {
    const many = Array.from({ length: RINGS_SIZE }, (_, i) => client({ clientId: `c${i}` }));
    const cells = coachHiveCells('Alex', many);
    expect(cells.some((c) => c.kind === HiveCellKinds.More)).toBe(false);
    expect(cells.filter((c) => c.kind === HiveCellKinds.Cell)).toHaveLength(RINGS_SIZE);
  });
});

describe('movedCount', () => {
  it('counts the done and the trained, not the rest', () => {
    expect(
      movedCount([
        client({ due: 1, completed: 1, daysSinceLastWorkout: 0 }),
        client({ daysSinceLastWorkout: 3 }),
        client({ daysSinceLastWorkout: 12 }),
        client(),
      ]),
    ).toBe(2);
  });
});

describe('weekDays', () => {
  const days = weekDays(
    SATURDAY,
    [
      log(new Date(2026, 9, 26, 18, 30).toISOString()),
      log(new Date(2026, 9, 28, 7, 0).toISOString(), 2),
      // Late on Wednesday, local: still Wednesday whatever the UTC day.
      log(new Date(2026, 9, 28, 23, 50).toISOString()),
      log(new Date(2026, 9, 29, 9, 0).toISOString(), 0, WorkoutLogStatus.InProgress),
    ],
    [planDay('2026-10-26', WorkoutLogStatus.Completed), planDay('2026-10-30')],
  );

  it('runs Monday to Sunday around the day', () => {
    expect(days.map((d) => d.key)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(days.findIndex((d) => d.isToday)).toBe(5);
  });

  it('marks trained, planned and record days from finished workouts only', () => {
    expect(days.map((d) => d.trained)).toEqual([true, false, true, false, false, false, false]);
    expect(days.map((d) => d.planned)).toEqual([true, false, false, false, true, false, false]);
    expect(days.map((d) => d.record)).toEqual([false, false, true, false, false, false, false]);
  });

  it('turns them into cells: honey trained, navy planned, ghost otherwise', () => {
    const cells = weekCells(days, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(cells.map((c) => c.kind)).toEqual([
      HiveCellKinds.Cell,
      HiveCellKinds.Ghost,
      HiveCellKinds.Cell,
      HiveCellKinds.Ghost,
      HiveCellKinds.Cell,
      HiveCellKinds.Ghost,
      HiveCellKinds.Ghost,
    ]);
    expect(cells.map((c) => c.fill)).toEqual([
      HiveFills.Honey,
      null,
      HiveFills.Honey,
      null,
      null,
      null,
      null,
    ]);
    expect(cells[5]!.ring).toBe(HiveRings.Today);
    expect(cells[2]!.dot).toBe(true);
    expect(cells[4]!.label).toBe('F');
  });
});

describe('weekSummary', () => {
  it('counts the plan, the days and the latest record', () => {
    const days = weekDays(
      SATURDAY,
      [log(new Date(2026, 9, 26, 9).toISOString(), 1), log(new Date(2026, 9, 29, 9).toISOString(), 1)],
      [],
    );
    const plan = [
      planDay('2026-10-26', WorkoutLogStatus.Completed),
      planDay('2026-10-31'),
      planDay('2026-11-01'),
    ];
    expect(weekSummary(days, plan, '2026-10-31')).toEqual({
      planned: 3,
      planDone: 1,
      trainedDays: 2,
      todayPending: true,
      recordDay: '2026-10-29',
    });
  });

  it('has nothing pending on a rest day', () => {
    const days = weekDays(SATURDAY, [], []);
    expect(weekSummary(days, [planDay('2026-10-30')], '2026-10-31').todayPending).toBe(false);
  });
});

describe('plansEndingSoon', () => {
  it('keeps active plans ending within the week, soonest first', () => {
    const ending = plansEndingSoon(
      [
        plan('2026-11-06'),
        plan('2026-10-31'),
        plan('2026-11-07'),
        plan('2026-10-30'),
        plan(null),
        plan('2026-11-01', 'PAUSED'),
      ],
      '2026-10-31',
    );
    expect(ending.map((p) => p.endDate)).toEqual(['2026-10-31', '2026-11-06']);
  });
});

describe('knownDuration', () => {
  it('keeps a real length and drops a missing one or one past six hours', () => {
    expect(knownDuration(3000)).toBe(3000);
    expect(knownDuration(6 * 3600)).toBe(6 * 3600);
    expect(knownDuration(6 * 3600 + 1)).toBeNull();
    expect(knownDuration(3893055)).toBeNull();
    expect(knownDuration(null)).toBeNull();
    expect(knownDuration(0)).toBeNull();
  });
});

describe('endDay', () => {
  it('names today and tomorrow, and leaves later days to the weekday', () => {
    expect(endDay('2026-10-31', '2026-10-31')).toBe(EndDays.Today);
    expect(endDay('2026-11-01', '2026-10-31')).toBe(EndDays.Tomorrow);
    expect(endDay('2026-11-04', '2026-10-31')).toBe(EndDays.Later);
  });
});

describe('weekLine', () => {
  const summary = (overrides: Partial<WeekSummary>): WeekSummary => ({
    planned: 0,
    planDone: 0,
    trainedDays: 0,
    todayPending: false,
    recordDay: null,
    ...overrides,
  });

  it('says what today would do before anything else', () => {
    expect(weekLine(summary({ planned: 3, planDone: 1, todayPending: true, recordDay: '2026-10-28' }), 5)).toEqual({
      kind: WeekLineKinds.TodayMakes,
      count: 2,
    });
  });

  it('says the plan is done once it is', () => {
    expect(weekLine(summary({ planned: 2, planDone: 2, trainedDays: 2 }), 5)).toEqual({ kind: WeekLineKinds.PlanDone });
  });

  it('tells a new trainee what counts', () => {
    expect(weekLine(summary({}), 0)).toEqual({ kind: WeekLineKinds.Empty });
  });

  it('falls back to the record, then the streak, then nothing', () => {
    expect(weekLine(summary({ trainedDays: 2, recordDay: '2026-10-28' }), 4)).toEqual({
      kind: WeekLineKinds.Record,
      day: '2026-10-28',
    });
    expect(weekLine(summary({ trainedDays: 2 }), 4)).toEqual({ kind: WeekLineKinds.Streak, weeks: 4 });
    expect(weekLine(summary({ trainedDays: 2 }), 1)).toBeNull();
    expect(weekLine(summary({ planned: 3, planDone: 1 }), 1)).toBeNull();
  });
});

describe('needItems', () => {
  const clients = [
    client({ clientId: 'nop', name: 'Sarah Mitchell', attention: 'NO_PLAN' }),
    client({ clientId: 'beh', name: 'Mihai Pop', attention: 'BEHIND' }),
    client({ clientId: 'new', name: 'Elena Dumitru', attention: 'NEVER_STARTED' }),
    client({ clientId: 'ok', name: 'Ana Ionescu', attention: null }),
    client({ clientId: 'sil', name: 'Radu Toma', attention: 'SILENT' }),
    client({ clientId: 'drp', name: 'Ioana Cristea', attention: 'DROPPED' }),
  ];

  it('puts requests first, then the roster reasons, then plans ending', () => {
    const items = needItems(clients, 2, [plan('2026-11-04', 'ACTIVE', 'new')]);
    expect(items.map((i) => i.key)).toEqual([
      'requests',
      'client-new',
      'client-sil',
      'client-beh',
      'client-drp',
      'client-nop',
      'plan-2026-11-04',
    ]);
    expect(items.map((i) => i.reason)).toEqual([
      NeedReasons.Requests,
      NeedReasons.NotStarted,
      NeedReasons.Quiet,
      NeedReasons.Slipping,
      NeedReasons.Slipping,
      NeedReasons.NoPlan,
      NeedReasons.PlanEnding,
    ]);
  });

  it('leaves out requests when nobody is waiting, and clients the roster does not flag', () => {
    const items = needItems([client({ attention: null })], 0, []);
    expect(items).toEqual([]);
  });

  it('shows three on Home, one per person, and groups them all on the page', () => {
    const items = needItems(
      [client({ clientId: 'new', attention: 'NEVER_STARTED' }), client({ clientId: 'nop', attention: 'NO_PLAN' })],
      0,
      [plan('2026-11-04', 'ACTIVE', 'new'), plan('2026-11-05', 'ACTIVE', 'other')],
    );
    // Elena's plan is skipped on Home: she already has a row.
    expect(needPreview(items).map((i) => i.key)).toEqual(['client-new', 'client-nop', 'plan-2026-11-05']);
    expect(needPreview(items, 2)).toHaveLength(2);

    const groups = needGroups(items);
    expect(groups.map((g) => [g.reason, g.count])).toEqual([
      [NeedReasons.NotStarted, 1],
      [NeedReasons.NoPlan, 1],
      [NeedReasons.PlanEnding, 2],
    ]);
  });

  it('counts everyone asking in the requests group', () => {
    expect(needGroups(needItems([], 4, []))).toEqual([
      { reason: NeedReasons.Requests, count: 4, items: [expect.objectContaining({ key: 'requests' })] },
    ]);
  });
});

describe('needRow', () => {
  const copy: NeedCopy = { t: echo, locale: 'en-GB', todayKey: '2026-10-31' };
  const rowFor = (item: NeedItem) => needRow(item, copy);

  it('sends a request row to Review, with no person', () => {
    const [item] = needItems([], 2, []);
    expect(rowFor(item!)).toMatchObject({
      title: 'home.coach.needs.requests.title {"count":2}',
      action: NeedActions.Review,
      person: null,
    });
  });

  it('offers Message to a client who has not started, and Assign to one with no plan', () => {
    const [notStarted, noPlan] = needItems(
      [
        client({ clientId: 'a', name: 'Elena Dumitru', attention: 'NEVER_STARTED' }),
        client({ clientId: 'b', name: 'Sarah Mitchell', attention: 'NO_PLAN', lastWorkoutAt: '2026-10-21T10:00:00Z' }),
      ],
      0,
      [],
    );
    expect(rowFor(notStarted!)).toMatchObject({
      title: 'home.coach.needs.notStarted.title {"name":"Elena"}',
      action: NeedActions.Message,
      person: { id: 'a', name: 'Elena Dumitru' },
    });
    expect(rowFor(noPlan!)).toMatchObject({
      title: 'home.coach.needs.noPlan.title {"name":"Sarah"}',
      detail: 'home.coach.needs.quiet.detail {"date":"21 Oct"}',
      action: NeedActions.OpenClient,
    });
  });

  it('says how long a quiet client has been quiet, and which slip it is', () => {
    const [quiet, dropped, behind] = needItems(
      [
        client({ clientId: 'q', attention: 'SILENT', daysSinceLastWorkout: 15 }),
        client({ clientId: 'd', attention: 'DROPPED', adherencePercent: 40, previousAdherencePercent: 80 }),
        client({ clientId: 'b', attention: 'BEHIND', due: 4, completed: 1 }),
      ],
      0,
      [],
    );
    expect(rowFor(quiet!).title).toBe('home.coach.needs.quiet.title {"name":"Anna","days":15}');
    expect(rowFor(quiet!).detail).toBe('home.coach.needs.notStarted.detail');
    expect(rowFor(dropped!).detail).toBe('home.coach.needs.dropped.detail {"now":40,"before":80}');
    expect(rowFor(behind!).detail).toBe('home.coach.needs.behind.detail {"completed":1,"due":4}');
  });

  it('names the day a plan ends: today, tomorrow, or the weekday', () => {
    const titleFor = (endDate: string) =>
      rowFor(needItems([], 0, [plan(endDate)])[0]!).title;
    expect(titleFor('2026-10-31')).toContain('"when":"home.coach.needs.when.today"');
    expect(titleFor('2026-11-01')).toContain('"when":"home.coach.needs.when.tomorrow"');
    expect(titleFor('2026-11-04')).toContain('"when":"Wednesday"');
    expect(rowFor(needItems([], 0, [plan('2026-11-04')])[0]!)).toMatchObject({
      detail: 'home.coach.needs.planEnds.detail {"name":"Anna","percent":58}',
      action: NeedActions.OpenClient,
      person: { id: 'c1', name: 'Anna Popescu' },
    });
  });
});

describe('latestPreview', () => {
  const NOW = new Date('2026-10-31T12:00:00Z');
  const at = (hoursAgo: number) => ({ at: new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString() });

  it('shows everything from the last 24 hours, newest first', () => {
    const items = [at(30), at(2), at(23.9), at(48), at(0.5)];
    expect(latestPreview(items, NOW)).toEqual([at(0.5), at(2), at(23.9)]);
  });

  it('caps a busy day at ten', () => {
    const items = Array.from({ length: 14 }, (_, i) => at(i + 0.5));
    expect(latestPreview(items, NOW)).toHaveLength(10);
    expect(latestPreview(items, NOW)[0]).toEqual(at(0.5));
  });

  it('falls back to the latest three on a quiet day', () => {
    const items = [at(100), at(25), at(70), at(30), at(200)];
    expect(latestPreview(items, NOW)).toEqual([at(25), at(30), at(70)]);
    expect(latestPreview([at(50)], NOW)).toEqual([at(50)]);
    expect(latestPreview([], NOW)).toEqual([]);
  });
});

describe('withinDays and dayGroups', () => {
  it('keeps the window and groups by local day, newest first', () => {
    const now = new Date(2026, 9, 31, 12, 0);
    const items = [
      { at: new Date(2026, 9, 30, 9, 0).toISOString() },
      { at: new Date(2026, 9, 31, 8, 0).toISOString() },
      { at: new Date(2026, 9, 30, 23, 30).toISOString() },
      { at: new Date(2026, 9, 31, 11, 0).toISOString() },
      { at: new Date(2026, 9, 10, 11, 0).toISOString() },
    ];
    const kept = withinDays(items, 14, now);
    expect(kept).toHaveLength(4);

    const groups = dayGroups(kept);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['2026-10-31', 2],
      ['2026-10-30', 2],
    ]);
    expect(groups[0]!.items[0]!.at).toBe(new Date(2026, 9, 31, 11, 0).toISOString());
    expect(groups[1]!.items[0]!.at).toBe(new Date(2026, 9, 30, 23, 30).toISOString());
  });
});

describe('coachLatest and traineeLatest', () => {
  const now = new Date('2026-10-31T12:00:00Z');

  function workout(id: string, completedAt: string, overrides: Partial<CoachActivityItem> = {}): CoachActivityItem {
    return {
      workoutLogId: id,
      clientId: 'c1',
      name: 'Sarah Mitchell',
      avatarUrl: null,
      handle: null,
      workoutName: 'Upper A',
      completedAt,
      durationSeconds: 3120,
      recordCount: 0,
      ...overrides,
    };
  }

  function post(id: string, postedAt: string, overrides: Partial<Post> = {}): Post {
    return {
      id,
      authorId: 'u1',
      groupId: 'g1',
      content: 'Good   session\ntoday',
      mediaUrls: null,
      postedAt,
      author: { id: 'u1', firstName: 'Alex', lastName: 'Rivera', avatarUrl: null },
      group: { id: 'g1', name: 'Morning Crew', logoUrl: null },
      workout: null,
      ...overrides,
    } as Post;
  }

  function record(recordedAt: string, deltaKg = 2.5): ProgressRecord {
    return { exerciseId: 'e1', exerciseName: 'Barbell Squat', weightKg: 104.5, recordedAt, deltaKg };
  }

  it('says the coach feed stopped short only when it came back full inside the window', () => {
    expect(latestCapped(20, 20, 20)).toBe(true);
    // The twentieth is older than two weeks: the window was read to its start.
    expect(latestCapped(20, 19, 20)).toBe(false);
    expect(latestCapped(7, 7, 20)).toBe(false);
  });

  it('keeps the coach feed to the window, newest first', () => {
    const entries = coachLatest(
      [workout('old', '2026-10-10T10:00:00Z'), workout('b', '2026-10-30T10:00:00Z'), workout('a', '2026-10-31T09:00:00Z')],
      now,
    );
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(entries[0]!.kind).toBe(LatestKinds.Workout);
  });

  it('merges posts and records by time and drops what is past the window', () => {
    const entries = traineeLatest(
      [post('p1', '2026-10-28T10:00:00Z'), post('p0', '2026-09-26T10:00:00Z')],
      [record('2026-10-30T10:00:00Z'), record('2026-10-16T10:00:00Z')],
      now,
    );
    expect(entries.map((e) => e.kind)).toEqual([LatestKinds.Record, LatestKinds.Post]);
  });

  describe('latestRow', () => {
    const copy: LatestCopy = {
      t: echo,
      locale: 'en-GB',
      time: () => '3h',
      duration: (s) => `${Math.round(s / 60)}m`,
      tone: () => 'teal',
    };

    it('reads a workout as who, what, its records in honey, how long, opening in Home', () => {
      const [entry] = coachLatest([workout('w1', '2026-10-31T09:00:00Z', { recordCount: 2 })], now);
      expect(latestRow(entry!, copy)).toEqual({
        id: 'w1',
        title: 'Sarah Mitchell',
        note: '3h',
        parts: [
          { text: 'Upper A', accent: false, whole: false },
          { text: 'home.latest.records {"count":2}', accent: true, whole: true },
          { text: '52m', accent: false, whole: true },
        ],
        avatar: { name: 'Sarah Mitchell', imageUrl: null, color: 'teal', icon: null, wash: false },
        link: ['/tabs/home', 'log', 'w1'],
        state: null,
      });
    });

    it('drops a workout length nobody can know', () => {
      const [entry] = coachLatest([workout('w1', '2026-10-31T09:00:00Z', { durationSeconds: 3893055 })], now);
      expect(latestRow(entry!, copy).parts).toEqual([
        { text: 'Upper A', accent: false, whole: false },
      ]);
    });

    it('reads a post as its author, its group and its words, opening in Home', () => {
      const [entry] = traineeLatest([post('p1', '2026-10-31T09:00:00Z')], [], now);
      const row = latestRow(entry!, copy);
      expect(row.title).toBe('Alex Rivera');
      expect(row.parts.map((p) => p.text)).toEqual(['Morning Crew', 'Good session today']);
      // A group's name and a post's words give way; nothing here is a count.
      expect(row.parts.every((p) => !p.whole)).toBe(true);
      expect(row.link).toEqual(['/tabs/home/groups', 'post', 'p1']);
    });

    it('says what a post without words shared', () => {
      const shared = (overrides: Partial<Post>) =>
        latestRow(traineeLatest([post('p', '2026-10-31T09:00:00Z', { content: ' ', ...overrides })], [], now)[0]!, copy)
          .parts[1]!.text;
      expect(shared({ workout: { name: 'Push day' } as Post['workout'] })).toBe(
        'home.latest.sharedWorkout {"name":"Push day"}',
      );
      expect(shared({})).toBe('home.latest.sharedPhoto');
      const anonymous = latestRow(
        traineeLatest([post('p', '2026-10-31T09:00:00Z', { author: null })], [], now)[0]!,
        copy,
      );
      expect(anonymous.title).toBe('home.latest.member');
    });

    it('reads a record with its gain in honey, opening its progress in Home', () => {
      const [entry] = traineeLatest([], [record('2026-10-31T09:00:00Z')], now);
      expect(latestRow(entry!, copy)).toMatchObject({
        title: 'home.latest.record {"exercise":"Barbell Squat"}',
        parts: [
          { text: 'home.latest.recordDelta {"delta":"2.5"}', accent: true, whole: true },
          { text: 'home.latest.recordDetail {"weight":"104.5"}', accent: false, whole: false },
        ],
        avatar: { icon: 'trophy-outline', color: 'primary', wash: true },
        link: ['/tabs/home', 'progress', 'e1'],
        state: { exerciseName: 'Barbell Squat' },
      });
      // A first time on the exercise improved on nothing.
      const first = traineeLatest([], [record('2026-10-31T09:00:00Z', 104.5)], now)[0]!;
      expect(latestRow(first, copy).parts).toHaveLength(1);
    });
  });
});
