import {
  CoachActivityItem,
  Post,
  ProgramAssignment,
  ProgramAssignmentStatus,
  ProgressRecord,
  RosterAttention,
  RosterClient,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogStatus,
  dayFromKey,
  localDayKey,
  weekStart,
} from 'core';

import { ProfileStacks, groupBase } from '../../_shared/utils/stack-paths';
import { STREAK_WORTH_SAYING } from '../workouts/workouts.config';

/**
 * The pure half of both Homes and the pages they open: honeycomb geometry,
 * what colour a cell is, who needs the coach and in what order, what Latest
 * shows, and each row's words. Tested in `home.config.spec.ts`; the
 * components only inject, load and route.
 */

/** The translator the row builders are handed, so they stay pure. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

const DAY_MS = 86_400_000;

// ─── Greeting ────────────────────────────────────────────────────

export const GreetingPeriods = {
  Morning: 'morning',
  Afternoon: 'afternoon',
  Evening: 'evening',
} as const;

export type GreetingPeriod = (typeof GreetingPeriods)[keyof typeof GreetingPeriods];

/** Morning from 5, afternoon from 12, evening from 18 until the next 5. */
export function greetingPeriod(date: Date): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return GreetingPeriods.Morning;
  if (hour >= 12 && hour < 18) return GreetingPeriods.Afternoon;
  return GreetingPeriods.Evening;
}

// ─── Honeycomb geometry ──────────────────────────────────────────

/**
 * A cell is the app's hexagon (`HEX_PATH`) stood on its point, so the
 * honeycomb runs in rows as the design draws it: one unit wide and
 * 1 / cos 30° tall. Rows overlap by a quarter of a cell and every other one
 * shifts half a cell sideways, which is what makes them tessellate. The
 * spacing leaves a sliver of navy between neighbours.
 */
export const HEX_HEIGHT = 1.155;
const SPACING = 1.08;
const COL_STEP = SPACING;
const ROW_STEP = 0.866 * SPACING;

/** Where a cell's top-left corner sits, in cell widths from the grid's. */
export interface HivePlace {
  x: number;
  y: number;
}

/** Axial coordinates (q, r) to a place, before the grid is shifted to 0. */
function axial(q: number, r: number): HivePlace {
  return { x: (q + r / 2) * COL_STEP, y: r * ROW_STEP };
}

/** Moves a set of places so the top-left one is at 0, 0. */
function shifted(places: HivePlace[]): HivePlace[] {
  const minX = Math.min(...places.map((p) => p.x));
  const minY = Math.min(...places.map((p) => p.y));
  return places.map((p) => ({ x: round(p.x - minX), y: round(p.y - minY) }));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The six cells around the centre, clockwise from the upper left. */
const RING_ONE: readonly [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

/** The twelve around those, clockwise from the top row's left end. */
const RING_TWO: readonly [number, number][] = [
  [0, -2],
  [1, -2],
  [2, -2],
  [2, -1],
  [2, 0],
  [1, 1],
  [0, 2],
  [-1, 2],
  [-2, 2],
  [-2, 1],
  [-2, 0],
  [-1, -1],
];

/** How many people one ring holds, and two. Past two rings the list takes over. */
export const RING_ONE_SIZE = RING_ONE.length;
export const RINGS_SIZE = RING_ONE.length + RING_TWO.length;

/**
 * The centre and its rings: one ring while six cells hold everyone, two
 * after that. First place is the centre, then ring one, then ring two.
 */
export function ringPlaces(people: number): HivePlace[] {
  const rings = people > RING_ONE_SIZE ? [...RING_ONE, ...RING_TWO] : RING_ONE;
  return shifted([axial(0, 0), ...rings.map(([q, r]) => axial(q, r))]);
}

/**
 * The week, Monday first, as rows of two, three and two, read like text:
 * Monday and Tuesday, then Wednesday to Friday, then the weekend.
 */
export function weekPlaces(): HivePlace[] {
  const rows: [number, number][] = [
    [0.5, 0],
    [1.5, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0.5, 2],
    [1.5, 2],
  ];
  return shifted(rows.map(([col, row]) => ({ x: col * COL_STEP, y: row * ROW_STEP })));
}

// ─── Cells ───────────────────────────────────────────────────────

export const HiveCellKinds = {
  /** An empty place in the honeycomb. */
  Ghost: 'ghost',
  /** Someone, or a day, with nothing filled yet. */
  Cell: 'cell',
  /** The coach, in the middle of their clients. */
  Centre: 'centre',
  /** "+4": everyone the two rings could not hold. */
  More: 'more',
} as const;

export type HiveCellKind = (typeof HiveCellKinds)[keyof typeof HiveCellKinds];

export const HiveRings = {
  Today: 'today',
  Quiet: 'quiet',
} as const;

export type HiveRing = (typeof HiveRings)[keyof typeof HiveRings];

export const HiveFills = {
  /** Done: full honey. */
  Honey: 'honey',
  /** On the way: pale honey, the initials still dark on it. */
  Pale: 'pale',
} as const;

export type HiveFill = (typeof HiveFills)[keyof typeof HiveFills];

export interface HiveCell extends HivePlace {
  key: string;
  kind: HiveCellKind;
  /** The honey poured into the cell; null for an empty one. */
  fill: HiveFill | null;
  label: string;
  ring: HiveRing | null;
  /** A record was set here. */
  dot: boolean;
}

/** "Anna Popescu" → "AP"; one name gives one letter. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

// ─── The coach's hive ────────────────────────────────────────────

/**
 * What the roster says about a client over the last 7 days. The roster's
 * window is rolling, so these are too: nothing resets on a Monday.
 */
export const ClientHiveStates = {
  /** Every planned workout in the window, done. */
  Done: 'done',
  /** Trained in the window (a plan workout or their own). */
  Trained: 'trained',
  /** No workout logged, ever. */
  NotStarted: 'notStarted',
  /** Has trained, but not in the last 7 days. */
  Quiet: 'quiet',
} as const;

export type ClientHiveState = (typeof ClientHiveStates)[keyof typeof ClientHiveStates];

/** Honey first, so the filled cells gather at the top of the ring. */
const STATE_ORDER: readonly ClientHiveState[] = [
  ClientHiveStates.Done,
  ClientHiveStates.Trained,
  ClientHiveStates.NotStarted,
  ClientHiveStates.Quiet,
];

const QUIET_AFTER_DAYS = 7;

export function clientHiveState(
  client: Pick<RosterClient, 'due' | 'completed' | 'daysSinceLastWorkout'>,
): ClientHiveState {
  if (client.due > 0 && client.completed >= client.due) return ClientHiveStates.Done;
  if (client.daysSinceLastWorkout === null) return ClientHiveStates.NotStarted;
  if (client.daysSinceLastWorkout < QUIET_AFTER_DAYS) return ClientHiveStates.Trained;
  return ClientHiveStates.Quiet;
}

/**
 * The honey in a client's cell: full for done, pale for trained, none for
 * the rest. Pale rather than half full, so the initials stay readable on
 * one colour (the design's "On it").
 */
export function clientFill(
  client: Pick<RosterClient, 'due' | 'completed' | 'daysSinceLastWorkout'>,
): HiveFill | null {
  switch (clientHiveState(client)) {
    case ClientHiveStates.Done:
      return HiveFills.Honey;
    case ClientHiveStates.Trained:
      return HiveFills.Pale;
    default:
      return null;
  }
}

/** Clients who trained in the window: "6 of 8". */
export function movedCount(clients: readonly RosterClient[]): number {
  return clients.filter((client) => {
    const state = clientHiveState(client);
    return state === ClientHiveStates.Done || state === ClientHiveStates.Trained;
  }).length;
}

/**
 * The coach in the middle, clients around them. Two rings hold eighteen;
 * past that the last cell counts the rest ("+4") and the Clients tab has
 * them all.
 */
export function coachHiveCells(coachName: string, clients: readonly RosterClient[]): HiveCell[] {
  const ordered = [...clients].sort(
    (a, b) => STATE_ORDER.indexOf(clientHiveState(a)) - STATE_ORDER.indexOf(clientHiveState(b)),
  );
  const places = ringPlaces(ordered.length);
  const slots = places.length - 1;
  const overflow = ordered.length > slots ? ordered.length - (slots - 1) : 0;
  const shown = overflow ? ordered.slice(0, slots - 1) : ordered;

  const centre: HiveCell = {
    ...places[0]!,
    key: 'centre',
    kind: HiveCellKinds.Centre,
    fill: null,
    label: initialsOf(coachName),
    ring: null,
    dot: false,
  };

  const around = places.slice(1).map((place, i): HiveCell => {
    const client = shown[i];
    if (client) {
      const state = clientHiveState(client);
      return {
        ...place,
        key: client.clientId,
        kind: HiveCellKinds.Cell,
        fill: clientFill(client),
        label: initialsOf(client.name),
        ring: state === ClientHiveStates.Quiet ? HiveRings.Quiet : null,
        dot: false,
      };
    }
    if (overflow && i === slots - 1) {
      return { ...place, key: 'more', kind: HiveCellKinds.More, fill: null, label: `+${overflow}`, ring: null, dot: false };
    }
    return { ...place, key: `ghost-${i}`, kind: HiveCellKinds.Ghost, fill: null, label: '', ring: null, dot: false };
  });

  return [centre, ...around];
}

// ─── The trainee's week ──────────────────────────────────────────

export interface WeekDay {
  /** `yyyy-mm-dd`, local. */
  key: string;
  trained: boolean;
  planned: boolean;
  record: boolean;
  isToday: boolean;
}

/** The local day a finished workout counts for: when it ended. */
function logDayKey(log: WorkoutLog): string {
  return localDayKey(new Date(log.completedAt ?? log.startedAt));
}

/**
 * Monday to Sunday around `today`: which days were trained (any finished
 * workout, planned or not), which a plan asked for, and where a record fell.
 */
export function weekDays(
  today: Date,
  logs: readonly WorkoutLog[],
  plan: readonly TrainingDayWorkout[],
): WeekDay[] {
  const monday = weekStart(today);
  const todayKey = localDayKey(today);
  const finished = logs.filter((log) => log.status === WorkoutLogStatus.Completed);

  return Array.from({ length: 7 }, (_, i) => {
    const key = localDayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    const that = finished.filter((log) => logDayKey(log) === key);
    return {
      key,
      trained: that.length > 0,
      planned: plan.some((workout) => workout.scheduledDate === key),
      record: that.some((log) => (log.prCount ?? 0) > 0),
      isToday: key === todayKey,
    };
  });
}

/**
 * The week as honeycomb cells. A trained day is full honey, a planned one a
 * navy cell waiting for it, any other day a ghost; today wears the ring.
 * `letters` are the narrow weekday names, Monday first.
 */
export function weekCells(days: readonly WeekDay[], letters: readonly string[]): HiveCell[] {
  const places = weekPlaces();
  return days.map((day, i) => ({
    ...places[i]!,
    key: day.key,
    kind: day.trained || day.planned ? HiveCellKinds.Cell : HiveCellKinds.Ghost,
    fill: day.trained ? HiveFills.Honey : null,
    label: letters[i] ?? '',
    ring: day.isToday ? HiveRings.Today : null,
    dot: day.record,
  }));
}

/** What the card says beside the week. */
export interface WeekSummary {
  /** Workouts the plan asks for this week; 0 without a plan. */
  planned: number;
  /** Of those, done. */
  planDone: number;
  /** Days with a finished workout, planned or not. */
  trainedDays: number;
  /** Today is a plan day still to do: "Today would make it 3". */
  todayPending: boolean;
  /** The latest day this week with a record, if any. */
  recordDay: string | null;
}

export function weekSummary(
  days: readonly WeekDay[],
  plan: readonly TrainingDayWorkout[],
  todayKey: string,
): WeekSummary {
  const recordDays = days.filter((day) => day.record);
  return {
    planned: plan.length,
    planDone: plan.filter((workout) => workout.status === WorkoutLogStatus.Completed).length,
    trainedDays: days.filter((day) => day.trained).length,
    todayPending: plan.some((workout) => workout.scheduledDate === todayKey && workout.status === null),
    recordDay: recordDays.length ? recordDays[recordDays.length - 1]!.key : null,
  };
}

/** The window the week's workouts are read with: Monday to next Monday, local. */
export function weekRange(today: Date): { dateFrom: string; dateTo: string } {
  const monday = weekStart(today);
  const next = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return { dateFrom: monday.toISOString(), dateTo: next.toISOString() };
}


/** The one line under the week's headline, in the order it is worth saying. */
export const WeekLineKinds = {
  /** A plan day is still to do today: "Today would make it 3". */
  TodayMakes: 'todayMakes',
  /** Every planned workout of the week is done. */
  PlanDone: 'planDone',
  /** No plan and nothing trained yet: what counts. */
  Empty: 'empty',
  /** A record fell this week: "Record on Wednesday". */
  Record: 'record',
  /** Weeks in a row: "3 weeks in a row". */
  Streak: 'streak',
} as const;

export type WeekLine =
  | { kind: typeof WeekLineKinds.TodayMakes; count: number }
  | { kind: typeof WeekLineKinds.PlanDone }
  | { kind: typeof WeekLineKinds.Empty }
  | { kind: typeof WeekLineKinds.Record; day: string }
  | { kind: typeof WeekLineKinds.Streak; weeks: number };

/**
 * The card says one thing under the number, never a row of facts: what
 * today would do, then that the plan is done, then a record, then the
 * streak. Null when none of it applies.
 */
export function weekLine(summary: WeekSummary, streakWeeks: number): WeekLine | null {
  if (summary.planned) {
    if (summary.todayPending) {
      return { kind: WeekLineKinds.TodayMakes, count: summary.planDone + 1 };
    }
    if (summary.planDone >= summary.planned) return { kind: WeekLineKinds.PlanDone };
  } else if (!summary.trainedDays) {
    return { kind: WeekLineKinds.Empty };
  }
  if (summary.recordDay) return { kind: WeekLineKinds.Record, day: summary.recordDay };
  if (streakWeeks >= STREAK_WORTH_SAYING) return { kind: WeekLineKinds.Streak, weeks: streakWeeks };
  return null;
}

// ─── Durations and names ─────────────────────────────────────────

/**
 * Past this a workout's length is unknown: the server stores no duration
 * for one over six hours of active time. Older rows from before that rule
 * still carry days, so Home applies it on the way in.
 */
const LONGEST_KNOWN_WORKOUT_S = 6 * 3600;

export function knownDuration(seconds: number | null): number | null {
  return seconds && seconds <= LONGEST_KNOWN_WORKOUT_S ? seconds : null;
}

/** "Anna Maria Popescu" → "Anna". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

// ─── Needs you ───────────────────────────────────────────────────

/** How far ahead a plan's end counts as "ends soon". */
const ENDING_WITHIN_DAYS = 7;

/**
 * Active plans that end within the week, soonest first. A plan with no end
 * date rolls on and never shows.
 */
export function plansEndingSoon(
  assignments: readonly ProgramAssignment[],
  todayKey: string,
): ProgramAssignment[] {
  const today = dayFromKey(todayKey).getTime();
  return assignments
    .filter((plan) => {
      if (plan.status !== ProgramAssignmentStatus.Active || !plan.endDate) return false;
      const days = Math.round((dayFromKey(plan.endDate).getTime() - today) / DAY_MS);
      return days >= 0 && days < ENDING_WITHIN_DAYS;
    })
    .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''));
}

export const EndDays = {
  Today: 'today',
  Tomorrow: 'tomorrow',
  Later: 'later',
} as const;

export type EndDay = (typeof EndDays)[keyof typeof EndDays];

/** Whether an end date is today, tomorrow, or a weekday to name. */
export function endDay(endDate: string, todayKey: string): EndDay {
  const days = Math.round((dayFromKey(endDate).getTime() - dayFromKey(todayKey).getTime()) / DAY_MS);
  if (days <= 0) return EndDays.Today;
  if (days === 1) return EndDays.Tomorrow;
  return EndDays.Later;
}

/**
 * Why someone needs the coach, in the order Needs you reads: whoever waits
 * on an answer first, then the clients the roster flags, then plans about
 * to end. The Needs you page groups by these, one heading each.
 */
export const NeedReasons = {
  /** People who asked to train with the coach. */
  Requests: 'requests',
  /** Assigned work, nothing ever logged. */
  NotStarted: 'notStarted',
  /** No workout in two weeks. */
  Quiet: 'quiet',
  /** Training less than before, or under half of what was due. */
  Slipping: 'slipping',
  /** No active plan, so nothing is asked of them. */
  NoPlan: 'noPlan',
  /** An active plan ends within the week. */
  PlanEnding: 'planEnding',
} as const;

export type NeedReason = (typeof NeedReasons)[keyof typeof NeedReasons];

type ClientReason =
  | typeof NeedReasons.NotStarted
  | typeof NeedReasons.Quiet
  | typeof NeedReasons.Slipping
  | typeof NeedReasons.NoPlan;

/** One thing that needs the coach, before it is put into words. */
export type NeedItem =
  | { reason: typeof NeedReasons.Requests; key: string; personId: null; count: number }
  | { reason: ClientReason; key: string; personId: string; client: RosterClient }
  | {
      reason: typeof NeedReasons.PlanEnding;
      key: string;
      personId: string;
      plan: ProgramAssignment;
    };

const NEED_ORDER: readonly NeedReason[] = Object.values(NeedReasons);

const ATTENTION_REASONS: Record<NonNullable<RosterAttention>, ClientReason> = {
  NEVER_STARTED: NeedReasons.NotStarted,
  SILENT: NeedReasons.Quiet,
  DROPPED: NeedReasons.Slipping,
  BEHIND: NeedReasons.Slipping,
  NO_PLAN: NeedReasons.NoPlan,
};

/**
 * Everything that needs the coach, most pressing reason first. Inside a
 * reason the roster's own order holds (it lists the least adherent first)
 * and plans run soonest first.
 */
export function needItems(
  clients: readonly RosterClient[],
  pendingRequests: number,
  endingPlans: readonly ProgramAssignment[],
): NeedItem[] {
  const items: NeedItem[] = [];
  if (pendingRequests > 0) {
    items.push({
      reason: NeedReasons.Requests,
      key: 'requests',
      personId: null,
      count: pendingRequests,
    });
  }
  for (const client of clients) {
    const reason = client.attention ? ATTENTION_REASONS[client.attention] : null;
    if (reason) {
      items.push({ reason, key: `client-${client.clientId}`, personId: client.clientId, client });
    }
  }
  for (const plan of endingPlans) {
    items.push({
      reason: NeedReasons.PlanEnding,
      key: `plan-${plan.id}`,
      personId: plan.clientId,
      plan,
    });
  }
  // `sort` is stable, so each reason keeps the order it was added in.
  return items.sort((a, b) => NEED_ORDER.indexOf(a.reason) - NEED_ORDER.indexOf(b.reason));
}

/** Rows Needs you shows on Home before "Show more". */
export const NEEDS_PREVIEW = 3;

/**
 * Home's rows: at most three, and one per person, under their most
 * pressing reason. A client who has not started and whose plan ends on
 * Friday is one row on Home and two on the Needs you page.
 */
export function needPreview(items: readonly NeedItem[], max = NEEDS_PREVIEW): NeedItem[] {
  const seen = new Set<string>();
  const shown: NeedItem[] = [];
  for (const item of items) {
    if (shown.length >= max) break;
    if (item.personId) {
      if (seen.has(item.personId)) continue;
      seen.add(item.personId);
    }
    shown.push(item);
  }
  return shown;
}

export interface NeedGroup {
  reason: NeedReason;
  /** People in it: the requests row counts everyone asking. */
  count: number;
  items: NeedItem[];
}

/** The Needs you page: a heading per reason that has anyone, in order. */
export function needGroups(items: readonly NeedItem[]): NeedGroup[] {
  return NEED_ORDER.map((reason) => {
    const of = items.filter((item) => item.reason === reason);
    const count = of.reduce(
      (sum, item) => sum + (item.reason === NeedReasons.Requests ? item.count : 1),
      0,
    );
    return { reason, count, items: of };
  }).filter((group) => group.items.length > 0);
}

export const NeedActions = {
  /** The Clients tab on its Requests chip. */
  Review: 'review',
  /** The chat with them. */
  Message: 'message',
  /** Their client page, where a plan is assigned or extended. */
  OpenClient: 'openClient',
} as const;

export type NeedAction = (typeof NeedActions)[keyof typeof NeedActions];

export interface NeedPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** One row of Needs you, in the reader's words, with its one verb. */
export interface NeedRow {
  key: string;
  title: string;
  detail: string;
  verb: string;
  action: NeedAction;
  /** Who it is about; null for the requests row. */
  person: NeedPerson | null;
}

/** What `needRow` needs to put an item into words. */
export interface NeedCopy {
  t: Translate;
  locale: string;
  todayKey: string;
}

/** "21 Oct", in the reader's language. */
function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** "today", "tomorrow", or the weekday, in the reader's language. */
function endWhen(endDate: string, copy: NeedCopy): string {
  const day = endDay(endDate, copy.todayKey);
  if (day === EndDays.Today) return copy.t('home.coach.needs.when.today');
  if (day === EndDays.Tomorrow) return copy.t('home.coach.needs.when.tomorrow');
  return dayFromKey(endDate).toLocaleDateString(copy.locale, { weekday: 'long' });
}

/** An item as a row: the title says who and why, the detail adds one fact. */
export function needRow(item: NeedItem, copy: NeedCopy): NeedRow {
  const t = (key: string, params?: Record<string, unknown>) =>
    copy.t(`home.coach.needs.${key}`, params);

  if (item.reason === NeedReasons.Requests) {
    return {
      key: item.key,
      title: t('requests.title', { count: item.count }),
      detail: t('requests.detail'),
      verb: t('verb.review'),
      action: NeedActions.Review,
      person: null,
    };
  }

  if (item.reason === NeedReasons.PlanEnding) {
    const plan = item.plan;
    const name = fullName(plan.client?.firstName, plan.client?.lastName);
    return {
      key: item.key,
      title: t('planEnds.title', {
        plan: plan.programNameSnapshot,
        when: endWhen(plan.endDate ?? '', copy),
      }),
      detail: t('planEnds.detail', { name: firstNameOf(name), percent: plan.completionPercent }),
      verb: copy.t('button.open'),
      action: NeedActions.OpenClient,
      person: { id: plan.clientId, name, avatarUrl: plan.client?.avatarUrl ?? null },
    };
  }

  const client = item.client;
  const name = firstNameOf(client.name);
  const base = {
    key: item.key,
    person: { id: client.clientId, name: client.name, avatarUrl: client.avatarUrl },
  };
  // When they last trained says more than a bare reason would.
  const lastWorkout = client.lastWorkoutAt
    ? t('quiet.detail', { date: shortDate(client.lastWorkoutAt, copy.locale) })
    : t('notStarted.detail');

  switch (client.attention) {
    case 'NO_PLAN':
      return {
        ...base,
        title: t('noPlan.title', { name }),
        detail: lastWorkout,
        verb: t('verb.assign'),
        action: NeedActions.OpenClient,
      };
    case 'NEVER_STARTED':
      return {
        ...base,
        title: t('notStarted.title', { name }),
        detail: t('notStarted.detail'),
        verb: t('verb.message'),
        action: NeedActions.Message,
      };
    case 'SILENT':
      return {
        ...base,
        title: t('quiet.title', { name, days: client.daysSinceLastWorkout ?? 0 }),
        detail: lastWorkout,
        verb: t('verb.message'),
        action: NeedActions.Message,
      };
    case 'DROPPED':
      return {
        ...base,
        title: t('dropped.title', { name }),
        detail: t('dropped.detail', {
          now: client.adherencePercent ?? 0,
          before: client.previousAdherencePercent ?? 0,
        }),
        verb: t('verb.message'),
        action: NeedActions.Message,
      };
    default:
      return {
        ...base,
        title: t('behind.title', { name }),
        detail: t('behind.detail', { completed: client.completed, due: client.due }),
        verb: t('verb.message'),
        action: NeedActions.Message,
      };
  }
}

// ─── Latest ──────────────────────────────────────────────────────

/** How far back Latest and its page reach: the coach feed's own window. */
export const LATEST_WINDOW_DAYS = 14;
/** What counts as new on Home. */
const RECENT_MS = 24 * 3600_000;
/** New items Home shows at most. */
const RECENT_MAX = 10;
/** Items Home shows when nothing is new. */
const LATEST_FALLBACK = 3;

/** Anything with a moment it happened. */
export interface Dated {
  at: string;
}

function timeOf(item: Dated): number {
  return new Date(item.at).getTime();
}

export function newestFirst<T extends Dated>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => timeOf(b) - timeOf(a));
}

/**
 * What Latest shows on Home: everything from the last 24 hours, up to ten;
 * on a quiet day, the latest three, so the block never says less than the
 * hive did.
 */
export function latestPreview<T extends Dated>(items: readonly T[], now: Date): T[] {
  const sorted = newestFirst(items);
  const cutoff = now.getTime() - RECENT_MS;
  const recent = sorted.filter((item) => timeOf(item) >= cutoff);
  return recent.length ? recent.slice(0, RECENT_MAX) : sorted.slice(0, LATEST_FALLBACK);
}

/** Items from the last `days` days, as they came. */
export function withinDays<T extends Dated>(items: readonly T[], days: number, now: Date): T[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return items.filter((item) => timeOf(item) >= cutoff);
}

export interface DayGroup<T> {
  /** `yyyy-mm-dd`, local. */
  key: string;
  items: T[];
}

/** Newest day first, each day's items newest first. */
export function dayGroups<T extends Dated>(items: readonly T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of newestFirst(items)) {
    const key = localDayKey(new Date(item.at));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export const LatestKinds = {
  /** A client's finished workout, for their coach. */
  Workout: 'workout',
  /** A post in one of the reader's groups. */
  Post: 'post',
  /** The reader's own record. */
  Record: 'record',
} as const;

export type LatestEntry =
  | { kind: typeof LatestKinds.Workout; id: string; at: string; workout: CoachActivityItem }
  | { kind: typeof LatestKinds.Post; id: string; at: string; post: Post }
  | { kind: typeof LatestKinds.Record; id: string; at: string; record: ProgressRecord };

/** The coach's: clients' finished workouts of the window, newest first. */
export function coachLatest(items: readonly CoachActivityItem[], now: Date): LatestEntry[] {
  const entries = items.map(
    (workout): LatestEntry => ({
      kind: LatestKinds.Workout,
      id: workout.workoutLogId,
      at: workout.completedAt,
      workout,
    }),
  );
  return newestFirst(withinDays(entries, LATEST_WINDOW_DAYS, now));
}

/**
 * Whether the coach's Latest may be missing older workouts: the API sends
 * at most `limit`, so a full answer whose every workout falls inside the
 * window stopped short of its start. One older than the window means the
 * window was read to its end.
 */
export function latestCapped(returned: number, shown: number, limit: number): boolean {
  return returned >= limit && shown >= limit;
}

/** The trainee's: their groups' posts and their own records, merged by time. */
export function traineeLatest(
  posts: readonly Post[],
  records: readonly ProgressRecord[],
  now: Date,
): LatestEntry[] {
  const entries: LatestEntry[] = [
    ...posts.map(
      (post): LatestEntry => ({
        kind: LatestKinds.Post,
        id: `post-${post.id}`,
        at: post.postedAt,
        post,
      }),
    ),
    ...records.map(
      (record): LatestEntry => ({
        kind: LatestKinds.Record,
        id: `record-${record.exerciseId}-${record.recordedAt}`,
        at: record.recordedAt,
        record,
      }),
    ),
  ];
  return newestFirst(withinDays(entries, LATEST_WINDOW_DAYS, now));
}

/**
 * One part of a row's second line; a record count wears the honey ink.
 * `whole` parts (a count, a length, a gain) are never cut: when the line
 * runs short at a large text size, the words around them (a workout's or
 * a group's name, a post) ellipsize instead, so "1 record" and "52m" stay.
 */
export interface LatestPart {
  text: string;
  accent: boolean;
  whole: boolean;
}

/** A Latest row, ready to draw: two lines and where a tap goes. */
export interface LatestRow {
  id: string;
  title: string;
  /** When, at the end of the first line. */
  note: string;
  /** The second line, said in parts joined by a middle dot. */
  parts: LatestPart[];
  avatar: {
    name: string;
    imageUrl: string | null;
    color: string;
    icon: string | null;
    wash: boolean;
  };
  /** Router commands, inside Home's own stack so back returns to it. */
  link: string[];
  state: Record<string, unknown> | null;
}

/** What `latestRow` needs to put an entry into words. */
export interface LatestCopy {
  t: Translate;
  locale: string;
  /** "3h" on Home, "16:20" on the page, under its day. */
  time: (iso: string) => string;
  /** A known workout length, "52m". */
  duration: (seconds: number) => string;
  /** A person's avatar fill, stable per id. */
  tone: (id: string) => string;
}

function kilos(value: number, locale: string): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}

export function latestRow(entry: LatestEntry, copy: LatestCopy): LatestRow {
  const note = copy.time(entry.at);

  switch (entry.kind) {
    case LatestKinds.Workout: {
      const workout = entry.workout;
      const seconds = knownDuration(workout.durationSeconds);
      const parts: LatestPart[] = [{ text: workout.workoutName, accent: false, whole: false }];
      if (workout.recordCount) {
        parts.push({
          text: copy.t('home.latest.records', { count: workout.recordCount }),
          accent: true,
          whole: true,
        });
      }
      if (seconds) parts.push({ text: copy.duration(seconds), accent: false, whole: true });
      return {
        id: entry.id,
        title: workout.name,
        note,
        parts,
        avatar: {
          name: workout.name,
          imageUrl: workout.avatarUrl,
          color: copy.tone(workout.clientId),
          icon: null,
          wash: false,
        },
        link: [ProfileStacks.Home, 'log', workout.workoutLogId],
        state: null,
      };
    }
    case LatestKinds.Post: {
      const post = entry.post;
      const author = post.author;
      const name = author ? fullName(author.firstName, author.lastName) : '';
      const text = post.content.trim()
        ? post.content.trim().replace(/\s+/g, ' ')
        : post.workout
          ? copy.t('home.latest.sharedWorkout', { name: post.workout.name })
          : copy.t('home.latest.sharedPhoto');
      const parts: LatestPart[] = [];
      if (post.group) parts.push({ text: post.group.name, accent: false, whole: false });
      parts.push({ text, accent: false, whole: false });
      return {
        id: entry.id,
        title: name || copy.t('home.latest.member'),
        note,
        parts,
        avatar: {
          name,
          imageUrl: author?.avatarUrl ?? null,
          color: copy.tone(post.authorId),
          icon: null,
          wash: false,
        },
        link: [groupBase(ProfileStacks.Home), 'post', post.id],
        state: null,
      };
    }
    case LatestKinds.Record: {
      const record = entry.record;
      const parts: LatestPart[] = [];
      // A first time on an exercise improves on nothing; only a real gain is said.
      if (record.deltaKg > 0 && record.deltaKg < record.weightKg) {
        parts.push({
          text: copy.t('home.latest.recordDelta', { delta: kilos(record.deltaKg, copy.locale) }),
          accent: true,
          whole: true,
        });
      }
      parts.push({
        text: copy.t('home.latest.recordDetail', { weight: kilos(record.weightKg, copy.locale) }),
        accent: false,
        whole: false,
      });
      return {
        id: entry.id,
        title: copy.t('home.latest.record', { exercise: record.exerciseName }),
        note,
        parts,
        avatar: {
          name: record.exerciseName,
          imageUrl: null,
          color: 'primary',
          icon: 'trophy-outline',
          wash: true,
        },
        link: [ProfileStacks.Home, 'progress', record.exerciseId],
        state: { exerciseName: record.exerciseName },
      };
    }
  }
}
