import {
  AssignedWorkout,
  ProgramAssignment,
  RosterClient,
  RosterSummary,
  RosterWindow,
  WorkoutLog,
  WorkoutLogStatus,
  dayFromKey,
  localDayKey,
  weekStart,
} from 'core';
import {
  addOutline,
  barbellOutline,
  calendarOutline,
  chatbubbleOutline,
  cloudOfflineOutline,
  peopleOutline,
  personOutline,
  trophyOutline,
} from 'ionicons/icons';

import {
  BoardCell,
  BoardLooks,
  BoardRings,
  boardCell,
  planFill,
  ringPlaces,
  stripPlaces,
  timelineDayKey,
} from '../_components/hive-board/hive-board.config';
import { EndDays, Translate, endDay, knownDuration, plansEndingSoon } from '../home.config';

/**
 * The pure half of the coach's hive page (`/tabs/home/hive`) and its
 * client sheet: who is in the comb and in what order, what each cell and
 * line says, the client's week, the sheet's actions and the totals. Tested
 * in `client-hive.config.spec.ts`; the components only load, route and
 * draw.
 */

/**
 * Every icon the page and its sheet render. `client-hive.config.spec.ts`
 * fails when this and the templates disagree.
 */
export const CLIENT_HIVE_ICONS = {
  addOutline,
  barbellOutline,
  calendarOutline,
  chatbubbleOutline,
  cloudOfflineOutline,
  peopleOutline,
  personOutline,
  trophyOutline,
};

// ─── Range and filter ────────────────────────────────────────────

/**
 * The roster's two windows. Both roll: "7 days" is the last seven, not a
 * calendar week, so the page says so (the Home card says "last 7 days" of
 * the same numbers).
 */
export const HiveRanges = {
  Week: '1w',
  Month: '4w',
} as const satisfies Record<string, RosterWindow>;

export const HIVE_RANGES: readonly RosterWindow[] = [HiveRanges.Week, HiveRanges.Month];

const RANGE_DAYS: Record<RosterWindow, number> = { '1w': 7, '4w': 28 };

/** A segment's value as a range, or null for anything else. */
export function rangeFrom(value: unknown): RosterWindow | null {
  return HIVE_RANGES.find((range) => range === value) ?? null;
}

export const HiveFilters = {
  All: 'all',
  /** The clients the roster flags: Home's Needs you, as people. */
  Attention: 'attention',
} as const;

export type HiveFilter = (typeof HiveFilters)[keyof typeof HiveFilters];

export function filterClients(
  clients: readonly RosterClient[],
  filter: HiveFilter,
): RosterClient[] {
  return filter === HiveFilters.Attention
    ? clients.filter((client) => client.attention !== null)
    : [...clients];
}

// ─── Who trained ─────────────────────────────────────────────────

/** A week without a workout: the cell's calm coral ring. */
export const QUIET_AFTER_DAYS = 7;

export function isQuiet(client: Pick<RosterClient, 'daysSinceLastWorkout'>): boolean {
  return client.daysSinceLastWorkout !== null && client.daysSinceLastWorkout >= QUIET_AFTER_DAYS;
}

/** Trained inside the range: "6 of 8 trained". */
export function trainedIn(
  client: Pick<RosterClient, 'daysSinceLastWorkout'>,
  range: RosterWindow,
): boolean {
  return client.daysSinceLastWorkout !== null && client.daysSinceLastWorkout < RANGE_DAYS[range];
}

export function movedCount(clients: readonly RosterClient[], range: RosterWindow): number {
  return clients.filter((client) => trainedIn(client, range)).length;
}

/**
 * Where a client sits in the comb: the most honey first, so the filled
 * cells gather in the inner ring, then those with a plan and nothing done,
 * then no plan, then no workout ever, the quiet ones last.
 */
export function clientRank(
  client: Pick<RosterClient, 'due' | 'completed' | 'daysSinceLastWorkout'>,
): number {
  if (isQuiet(client)) return 4;
  const fill = planFill(client.completed, client.due);
  if (fill !== null) return 1 - fill;
  return client.daysSinceLastWorkout === null ? 3 : 2;
}

export function orderedClients(clients: readonly RosterClient[]): RosterClient[] {
  // `sort` is stable: inside a rank the roster's own order holds.
  return [...clients].sort((a, b) => clientRank(a) - clientRank(b));
}

// ─── What a client's line says ───────────────────────────────────

export const ClientStatusKinds = {
  /** A week or more since the last workout. */
  Quiet: 'quiet',
  /** No workout ever. */
  NotStarted: 'notStarted',
  /** Work was due in the range: how much is done. */
  Plan: 'plan',
  /** Trains, with nothing asked of them. */
  NoPlan: 'noPlan',
} as const;

export type ClientStatus =
  | { kind: typeof ClientStatusKinds.Quiet; days: number }
  | { kind: typeof ClientStatusKinds.NotStarted }
  | { kind: typeof ClientStatusKinds.Plan; completed: number; due: number }
  | { kind: typeof ClientStatusKinds.NoPlan };

/** The one thing worth saying, most pressing first. */
export function clientStatus(
  client: Pick<RosterClient, 'due' | 'completed' | 'daysSinceLastWorkout'>,
): ClientStatus {
  if (isQuiet(client)) {
    return { kind: ClientStatusKinds.Quiet, days: client.daysSinceLastWorkout ?? 0 };
  }
  if (client.daysSinceLastWorkout === null) return { kind: ClientStatusKinds.NotStarted };
  if (client.due > 0) {
    return { kind: ClientStatusKinds.Plan, completed: client.completed, due: client.due };
  }
  return { kind: ClientStatusKinds.NoPlan };
}

export function statusText(status: ClientStatus, range: RosterWindow, t: Translate): string {
  switch (status.kind) {
    case ClientStatusKinds.Quiet:
      return t('clientHive.status.quiet', { days: status.days });
    case ClientStatusKinds.NotStarted:
      return t('clientHive.status.notStarted');
    case ClientStatusKinds.Plan:
      return t(`clientHive.status.plan.${range}`, {
        completed: status.completed,
        due: status.due,
      });
    case ClientStatusKinds.NoPlan:
      return t('clientHive.status.noPlan');
  }
}

// ─── The comb ────────────────────────────────────────────────────

export interface HivePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** What the cell builders need besides the people. */
export interface HiveCopy {
  t: Translate;
  range: RosterWindow;
  /** A person's avatar tone, stable per id (`avatarToneFor`). */
  tone: (id: string) => string;
}

/**
 * The coach in the middle, each client a cell around them, as many rings
 * as it takes. A client's honey is how much of their plan they did in the
 * range; no plan is a dashed edge with no track; a quiet week a coral ring.
 * The ring's leftover places are empty cells.
 */
export function clientHiveCells(
  coach: HivePerson,
  clients: readonly RosterClient[],
  copy: HiveCopy,
): BoardCell[] {
  const ordered = orderedClients(clients);
  const places = ringPlaces(ordered.length);
  const centre = boardCell(places[0]!, 'centre', BoardLooks.Bare, {
    avatar: { name: coach.name, imageUrl: coach.avatarUrl, tone: copy.tone(coach.id) },
    ring: BoardRings.Centre,
  });

  const around = places.slice(1).map((place, i): BoardCell => {
    const client = ordered[i];
    if (!client) return boardCell(place, `ghost-${i}`, BoardLooks.Ghost);
    const fill = planFill(client.completed, client.due);
    const status = statusText(clientStatus(client), copy.range, copy.t);
    return boardCell(place, client.clientId, fill === null ? BoardLooks.Dashed : BoardLooks.Solid, {
      fill: fill ?? 0,
      name: copy.t('clientHive.cell', { name: client.name, status }),
      avatar: { name: client.name, imageUrl: client.avatarUrl, tone: copy.tone(client.clientId) },
      ring: isQuiet(client) ? BoardRings.Quiet : null,
    });
  });

  return [centre, ...around];
}

/**
 * While the roster is on its way: the coach and two rings of empty cells,
 * the shape most hives take, breathing.
 */
export function ghostHiveCells(): BoardCell[] {
  return ringPlaces(12).map((place, i) =>
    boardCell(place, i ? `ghost-${i - 1}` : 'centre', BoardLooks.Ghost),
  );
}

// ─── Totals ──────────────────────────────────────────────────────

export interface HiveTotal {
  key: string;
  label: string;
  value: string;
  hint: string | null;
}

/**
 * What the roster adds up to for the range on screen: the workouts (beside
 * the same length of time before it), the records, and how much of the
 * plans got done when anything was due.
 */
export function hiveTotals(totals: RosterSummary['totals'], t: Translate): HiveTotal[] {
  const tiles: HiveTotal[] = [
    {
      key: 'workouts',
      label: t('clientHive.totals.workouts'),
      value: String(totals.workouts),
      hint: t('clientHive.totals.before', { count: totals.previousWorkouts }),
    },
    {
      key: 'records',
      label: t('clientHive.totals.records'),
      value: String(totals.records),
      hint: null,
    },
  ];
  if (totals.adherencePercent !== null) {
    tiles.push({
      key: 'plan',
      label: t('clientHive.totals.plan'),
      value: t('clientHive.totals.percent', { percent: Math.round(totals.adherencePercent) }),
      hint: null,
    });
  }
  return tiles;
}

// ─── The client's week ───────────────────────────────────────────

export const WeekDayStates = {
  Trained: 'trained',
  Skipped: 'skipped',
  Planned: 'planned',
  None: 'none',
} as const;

export type WeekDayState = (typeof WeekDayStates)[keyof typeof WeekDayStates];

export interface ClientWeekDay {
  /** `yyyy-mm-dd`, local. */
  key: string;
  state: WeekDayState;
  isToday: boolean;
}

/** Monday to the next Monday around `today`, local, as the list reads them. */
export function weekWindow(today: Date): { dateFrom: string; dateTo: string } {
  const monday = weekStart(today);
  const next = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return { dateFrom: monday.toISOString(), dateTo: next.toISOString() };
}

/**
 * Monday to Sunday: a finished workout makes the day trained, a skipped
 * plan day skipped, a plan day not yet done planned; nothing else is
 * nothing. Trained wins over skipped, skipped over planned.
 */
export function clientWeek(
  today: Date,
  logs: readonly WorkoutLog[],
  planned: readonly Pick<AssignedWorkout, 'scheduledDate' | 'status'>[],
): ClientWeekDay[] {
  const monday = weekStart(today);
  const todayKey = localDayKey(today);
  const trained = new Set(
    logs.filter((log) => log.status === WorkoutLogStatus.Completed).map(timelineDayKey),
  );
  const skipped = new Set([
    ...logs.filter((log) => log.status === WorkoutLogStatus.Skipped).map(timelineDayKey),
    ...planned
      .filter((workout) => workout.status === WorkoutLogStatus.Skipped)
      .map((workout) => workout.scheduledDate),
  ]);
  const toDo = new Set(
    planned.filter((workout) => workout.status === null).map((workout) => workout.scheduledDate),
  );

  return Array.from({ length: 7 }, (_, i) => {
    const key = localDayKey(
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
    );
    const state = trained.has(key)
      ? WeekDayStates.Trained
      : skipped.has(key)
        ? WeekDayStates.Skipped
        : toDo.has(key)
          ? WeekDayStates.Planned
          : WeekDayStates.None;
    return { key, state, isToday: key === todayKey };
  });
}

/** The week as a strip of seven cells: honey, a waiting track, a dashed edge, or a ghost. */
export function weekStripCells(days: readonly ClientWeekDay[]): BoardCell[] {
  const places = stripPlaces(days.length);
  return days.map((day, i) => {
    const ring = day.isToday ? BoardRings.Today : null;
    switch (day.state) {
      case WeekDayStates.Trained:
        return boardCell(places[i]!, day.key, BoardLooks.Solid, { fill: 1, ring });
      case WeekDayStates.Planned:
        return boardCell(places[i]!, day.key, BoardLooks.Solid, { ring });
      case WeekDayStates.Skipped:
        return boardCell(places[i]!, day.key, BoardLooks.Dashed, { ring });
      default:
        return boardCell(places[i]!, day.key, BoardLooks.Ghost, { ring });
    }
  });
}

/** The strip for a screen reader: how many of each. */
export function weekSummaryText(days: readonly ClientWeekDay[], t: Translate): string {
  const count = (state: WeekDayState) => days.filter((day) => day.state === state).length;
  return t('clientHive.sheet.weekA11y', {
    trained: count(WeekDayStates.Trained),
    planned: count(WeekDayStates.Planned),
    skipped: count(WeekDayStates.Skipped),
  });
}

/**
 * The days a client's active plans ask for in the week, from each plan's
 * tree; anything outside the week is left out.
 */
export function plannedInWeek(
  plans: readonly ProgramAssignment[],
  window: { dateFrom: string; dateTo: string },
): Pick<AssignedWorkout, 'scheduledDate' | 'status'>[] {
  const from = localDayKey(new Date(window.dateFrom));
  const to = localDayKey(new Date(window.dateTo));
  return plans
    .flatMap((plan) => plan.workouts ?? [])
    .filter((workout) => workout.scheduledDate >= from && workout.scheduledDate < to)
    .map((workout) => ({ scheduledDate: workout.scheduledDate, status: workout.status }));
}

// ─── Last workout ────────────────────────────────────────────────

export interface LastWorkoutRow {
  id: string;
  title: string;
  detail: string;
  record: boolean;
}

/** What the row needs to put a workout into words. */
export interface LastWorkoutCopy {
  t: Translate;
  /** "4d", "yesterday": how long ago it ended. */
  time: (iso: string) => string;
  /** A known workout length, "52m". */
  duration: (seconds: number) => string;
}

/** The latest finished workout: its name, then when, how long and its records. */
export function lastWorkoutRow(log: WorkoutLog, copy: LastWorkoutCopy): LastWorkoutRow {
  const parts = [copy.time(log.completedAt ?? log.startedAt)];
  const seconds = knownDuration(log.durationSeconds);
  if (seconds) parts.push(copy.duration(seconds));
  const records = log.prCount ?? 0;
  if (records > 0) parts.push(copy.t('clientHive.sheet.records', { count: records }));
  return { id: log.id, title: log.name, detail: parts.join(' · '), record: records > 0 };
}

// ─── The sheet's actions ─────────────────────────────────────────

export const ClientActions = {
  Message: 'message',
  /** No active plan: their page, where one is assigned. */
  Assign: 'assign',
  /** An active plan ends within the week: their plans, to extend or follow up. */
  OpenPlan: 'openPlan',
  Profile: 'profile',
} as const;

export type ClientAction = (typeof ClientActions)[keyof typeof ClientActions];

export interface ClientActionTile {
  id: ClientAction;
  label: string;
  icon: string;
  /** The honey one: the action that fits, or Message when none does. */
  main: boolean;
}

/**
 * Message, the one action that fits (as Home's Needs you decides it:
 * assign when there is no plan, open the plan when it ends soon), then the
 * client's page. Honey goes to the action that fits, else to Message.
 */
export function clientActions(
  client: Pick<RosterClient, 'activePlans'>,
  planEndsSoon: boolean,
  t: Translate,
): ClientActionTile[] {
  const fits: ClientAction | null =
    client.activePlans === 0 ? ClientActions.Assign : planEndsSoon ? ClientActions.OpenPlan : null;
  const tiles: ClientActionTile[] = [
    {
      id: ClientActions.Message,
      label: t('clientHive.sheet.actions.message'),
      icon: 'chatbubble-outline',
      main: fits === null,
    },
  ];
  if (fits === ClientActions.Assign) {
    tiles.push({
      id: ClientActions.Assign,
      label: t('clientHive.sheet.actions.assign'),
      icon: 'add-outline',
      main: true,
    });
  } else if (fits === ClientActions.OpenPlan) {
    tiles.push({
      id: ClientActions.OpenPlan,
      label: t('clientHive.sheet.actions.openPlan'),
      icon: 'calendar-outline',
      main: true,
    });
  }
  tiles.push({
    id: ClientActions.Profile,
    label: t('clientHive.sheet.actions.profile'),
    icon: 'person-outline',
    main: false,
  });
  return tiles;
}

/** The client's active plan that ends soonest within the week, if any (Needs you's rule). */
export function endingPlanOf(
  clientId: string,
  assignments: readonly ProgramAssignment[],
  todayKey: string,
): ProgramAssignment | null {
  return (
    plansEndingSoon(
      assignments.filter((plan) => plan.clientId === clientId),
      todayKey,
    )[0] ?? null
  );
}

/** "Upper body ends Friday": when a plan ending soon is the reason for the action. */
export function planEndsText(
  plan: Pick<ProgramAssignment, 'programNameSnapshot' | 'endDate'>,
  todayKey: string,
  locale: string,
  t: Translate,
): string {
  const endDate = plan.endDate ?? todayKey;
  const day = endDay(endDate, todayKey);
  const when =
    day === EndDays.Today
      ? t('clientHive.sheet.when.today')
      : day === EndDays.Tomorrow
        ? t('clientHive.sheet.when.tomorrow')
        : dayFromKey(endDate).toLocaleDateString(locale, { weekday: 'long' });
  return t('clientHive.sheet.planEnds', { plan: plan.programNameSnapshot, when });
}
