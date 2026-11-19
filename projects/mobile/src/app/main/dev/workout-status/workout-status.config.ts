import { SetField, SetFields } from 'core';

import { RestLiveState } from '../../../_shared/native/rest-live';
import {
  ActiveRest,
  ActiveSession,
  LiveStep,
  LiveValues,
} from '../../workouts/_services/active-session.store';
import { Translate } from '../../workouts/_services/lock-screen.config';
import { OVERTIME_CEILING_SECONDS } from '../../workouts/_components/rest-timer-bar/rest-timer-bar';
import { PAYLOAD_KEY, nextSetLine, setLine } from '../../workouts/logger/logger-flow';

/**
 * The developer's gallery of a workout in progress (`/tabs/more/dev/workout-status`,
 * never in a production build): mock data for the real in-app bars, and the
 * layout rules of the native lock screen ported from Swift and Java, so the
 * mock-ups show what the phone would.
 */

/** The ids the mock workout carries; nothing on the server has them. */
export const PREVIEW_LOG_ID = 'preview-log';
const PREVIEW_EXERCISE_ID = 'preview-exercise';
const PREVIEW_SET_ID = 'preview-set';
const PREVIEW_PREVIOUS_SET_ID = 'preview-set-before';
/** The superset partner's reps, after the design's push-ups. */
const PARTNER_REPS = 15;

/** The presets, one per state the surfaces can be in. */
export const PreviewScenarios = {
  BetweenSets: 'betweenSets',
  Resting: 'resting',
  Soon: 'soon',
  Go: 'go',
  Overtime: 'overtime',
  RestHidden: 'restHidden',
  Paused: 'paused',
  Superset: 'superset',
  AllDone: 'allDone',
} as const;
export type PreviewScenario = (typeof PreviewScenarios)[keyof typeof PreviewScenarios];

/** What the page lets you change. Times are relative to the moment it is applied. */
export interface PreviewMock {
  name: string;
  elapsedMinutes: number;
  paused: boolean;
  /** A rest runs (none while paused). */
  resting: boolean;
  /** The rest bar was put away (Hide, in overtime): the rest is kept, its end is not. */
  restHidden: boolean;
  restPlanned: number;
  /** Seconds to go; below zero is overtime. */
  restLeft: number;
  exercise: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  /** Sets of this exercise ticked, of how many (rounds, in a superset). */
  done: number;
  total: number;
  workoutDone: number;
  workoutTotal: number;
  superset: boolean;
  /** Sets left to do; off, everything is ticked. */
  ahead: boolean;
}

type KeysOf<T> = {
  [K in keyof PreviewMock]: PreviewMock[K] extends T ? K : never;
}[keyof PreviewMock];
export type PreviewNumberKey = KeysOf<number | null>;
export type PreviewTextKey = KeysOf<string>;
export type PreviewFlagKey = KeysOf<boolean>;

/** The form, in order: each field's key and the label it wears. */
export const PREVIEW_TEXT_FIELDS: readonly { key: PreviewTextKey; label: string }[] = [
  { key: 'name', label: 'dev.workoutStatus.field.name' },
  { key: 'exercise', label: 'dev.workoutStatus.field.exercise' },
];

/** A number on the form; `nullable` ones may be left empty (no weight, no reps). */
export interface PreviewNumberField {
  key: PreviewNumberKey;
  label: string;
  nullable?: boolean;
}

export const PREVIEW_NUMBER_FIELDS: readonly PreviewNumberField[] = [
  { key: 'elapsedMinutes', label: 'dev.workoutStatus.field.elapsed' },
  { key: 'setNumber', label: 'dev.workoutStatus.field.setNumber' },
  { key: 'restPlanned', label: 'dev.workoutStatus.field.restPlanned' },
  { key: 'restLeft', label: 'dev.workoutStatus.field.restLeft' },
  { key: 'weight', label: 'dev.workoutStatus.field.weight', nullable: true },
  { key: 'reps', label: 'dev.workoutStatus.field.reps', nullable: true },
  { key: 'lastWeight', label: 'dev.workoutStatus.field.lastWeight', nullable: true },
  { key: 'lastReps', label: 'dev.workoutStatus.field.lastReps', nullable: true },
  { key: 'done', label: 'dev.workoutStatus.field.done' },
  { key: 'total', label: 'dev.workoutStatus.field.total' },
  { key: 'workoutDone', label: 'dev.workoutStatus.field.workoutDone' },
  { key: 'workoutTotal', label: 'dev.workoutStatus.field.workoutTotal' },
];

/**
 * What a number field holds once typed: the number, null for an empty
 * field that may be empty, or undefined to leave the mock as it was (an
 * empty field that may not be, or something that is no number).
 */
export function parsePreviewNumber(
  raw: string | number | null | undefined,
  nullable: boolean,
): number | null | undefined {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return nullable ? null : undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export const PREVIEW_FLAG_FIELDS: readonly { key: PreviewFlagKey; label: string }[] = [
  { key: 'resting', label: 'dev.workoutStatus.toggle.resting' },
  { key: 'restHidden', label: 'dev.workoutStatus.toggle.restHidden' },
  { key: 'paused', label: 'dev.workoutStatus.toggle.paused' },
  { key: 'superset', label: 'dev.workoutStatus.toggle.superset' },
  { key: 'ahead', label: 'dev.workoutStatus.toggle.ahead' },
];

/** Bench press, set 3 of 4, seven sets into thirteen, 23 minutes in. */
function baseMock(translate: Translate): PreviewMock {
  return {
    name: translate('dev.workoutStatus.mock.workout'),
    elapsedMinutes: 23,
    paused: false,
    resting: false,
    restHidden: false,
    restPlanned: 90,
    restLeft: 62,
    exercise: translate('dev.workoutStatus.mock.exercise'),
    setNumber: 3,
    weight: 62.5,
    reps: 8,
    lastWeight: 60,
    lastReps: 8,
    done: 2,
    total: 4,
    workoutDone: 7,
    workoutTotal: 13,
    superset: false,
    ahead: true,
  };
}

/** A preset's mock data. */
export function previewMock(scenario: PreviewScenario, translate: Translate): PreviewMock {
  const base = baseMock(translate);
  switch (scenario) {
    case PreviewScenarios.BetweenSets:
      return base;
    case PreviewScenarios.Resting:
      return { ...base, resting: true };
    case PreviewScenarios.Soon:
      return { ...base, resting: true, restLeft: 7 };
    case PreviewScenarios.Go:
      // Go shows for three seconds, then the count turns to overtime.
      return { ...base, resting: true, restLeft: 0 };
    case PreviewScenarios.Overtime:
      return { ...base, resting: true, restLeft: -25 };
    case PreviewScenarios.RestHidden:
      return { ...base, resting: true, restHidden: true, restLeft: -40 };
    case PreviewScenarios.Paused:
      return { ...base, paused: true };
    case PreviewScenarios.Superset:
      return { ...base, resting: true, restLeft: 45, superset: true, done: 1, total: 3 };
    case PreviewScenarios.AllDone:
      return { ...base, ahead: false, done: 4, workoutDone: 13, elapsedMinutes: 52 };
  }
}

/** Everything a surface reads, anchored at one moment. */
export interface PreviewWorld {
  session: ActiveSession;
  rest: ActiveRest | null;
  /** "Set 3 · 62.5 kg × 8 · Bench press": the store's `next()`. */
  next: string;
  steps: LiveStep[];
}

/** The mock, as the store would hold it at `now`. */
export function previewWorld(mock: PreviewMock, now: number, translate: Translate): PreviewWorld {
  const steps = previewSteps(mock, translate);
  const next = steps.length > 0 ? steps[0].line : '';
  return {
    session: {
      id: PREVIEW_LOG_ID,
      name: mock.name,
      startedAt: new Date(now - mock.elapsedMinutes * 60_000).toISOString(),
      // Paused now: the clock stands at the minutes given.
      pausedAt: mock.paused ? new Date(now).toISOString() : null,
      pausedSeconds: 0,
    },
    rest: previewRest(mock, now, next),
    next,
    steps,
  };
}

/**
 * The rest timer's −15 / +15: the rest ends that much sooner or later, never
 * before now. A rest whose bar was hidden has no end to move.
 */
export function nudgedRest(rest: ActiveRest, seconds: number, now: number): ActiveRest {
  if (rest.endsAt === null) {
    return rest;
  }
  return { ...rest, endsAt: Math.max(now, rest.endsAt + seconds * 1000) };
}

function previewRest(mock: PreviewMock, now: number, next: string): ActiveRest | null {
  // A paused workout has no rest running.
  if (!mock.resting || mock.paused) {
    return null;
  }
  return {
    logId: PREVIEW_LOG_ID,
    exerciseId: PREVIEW_EXERCISE_ID,
    setId: PREVIEW_PREVIOUS_SET_ID,
    startedAt: now - (mock.restPlanned - mock.restLeft) * 1000,
    endsAt: mock.restHidden ? null : now + mock.restLeft * 1000,
    planned: mock.restPlanned,
    next,
  };
}

/** The next set in pieces, as the logger hands it to the lock screen. */
function previewSteps(mock: PreviewMock, translate: Translate): LiveStep[] {
  if (!mock.ahead) {
    return [];
  }
  const fields: SetField[] = [];
  if (mock.weight !== null) fields.push(SetFields.Weight);
  if (mock.reps !== null) fields.push(SetFields.Reps);
  const now = (field: SetField) => (field === SetFields.Weight ? mock.weight : mock.reps);
  const before = (field: SetField) =>
    field === SetFields.Weight ? mock.lastWeight : mock.lastReps;
  const target = setLine(fields, now, true);
  const short = setLine(fields, now, false);
  const lastSet = setLine(fields, before, false);
  const values: LiveValues = {};
  for (const field of fields) {
    const value = now(field);
    if (value !== null) values[PAYLOAD_KEY[field]] = value;
  }
  const round = mock.done + 1;
  const set = mock.superset
    ? translate('workouts.superset.round', { number: round })
    : translate('workouts.logger.setNumber', { number: mock.setNumber });
  const partner = translate('dev.workoutStatus.mock.partner');
  return [
    {
      exercise: mock.exercise,
      set,
      target,
      last: lastSet ? translate('workouts.logger.last', { value: lastSet }) : '',
      done: mock.done,
      total: mock.total,
      workoutDone: mock.workoutDone,
      workoutTotal: mock.workoutTotal,
      kicker: mock.superset
        ? translate('workouts.superset.kicker', { round, total: mock.total })
        : '',
      order: mock.superset
        ? [
            ['A1', mock.exercise, short],
            ['A2', partner, setLine([SetFields.Reps], () => PARTNER_REPS, false)],
          ]
            .map((parts) => parts.filter(Boolean).join(' '))
            .join(' → ')
        : '',
      exerciseId: PREVIEW_EXERCISE_ID,
      setId: PREVIEW_SET_ID,
      values,
      short,
      rest: mock.restPlanned,
      line: nextSetLine(set, target, mock.exercise, ''),
      final: false,
    },
  ];
}

// ─── The lock screen, as the phone draws it ─────────────────

/** The four faces of the Live Activity and the ongoing notification. */
export const LivePhases = {
  Rest: 'rest',
  Go: 'go',
  Workout: 'workout',
  Paused: 'paused',
} as const;
export type LivePhase = (typeof LivePhases)[keyof typeof LivePhases];

/** The layouts the Live Activity has. */
export const LiveLayouts = {
  Lock: 'lock',
  Expanded: 'expanded',
  Compact: 'compact',
  Minimal: 'minimal',
} as const;
export type LiveLayout = (typeof LiveLayouts)[keyof typeof LiveLayouts];

/** One button on the Live Activity: honey for the main one. */
export interface LiveChip {
  text: string;
  primary: boolean;
}

/** One small hexagon in the set dots. */
export const DotStates = { Done: 'done', Next: 'next', Todo: 'todo' } as const;
export type DotState = (typeof DotStates)[keyof typeof DotStates];

/** What `RichView` and the Dynamic Island show (`RestTimerWidget.swift`, `Face`). */
export interface LiveFace {
  phase: LivePhase;
  /** The small line over the number, in sentence case. */
  kicker: string;
  /** The countdown, "Done", the workout clock, or the clock standing still. */
  big: string;
  /** "+0:25" after Done, muted. */
  over: string;
  /** "of 1:30" beside the countdown, or "7 of 13 sets" beside the clock. */
  aside: string;
  /** The rest left, as a share of the planned; null when no rest runs. */
  restLeft: number | null;
  /** The line under the number. `plain` is muted; otherwise the pieces, target in honey. */
  nextLine: { shown: boolean; plain: string; lead: string; set: string; target: string };
  detail: string;
  dots: DotState[];
  /** "3/10" in place of the dots past eight. */
  dotsText: string;
  /** Beside the camera: the countdown, ✓, or the clock. */
  compact: string;
  /** Buttons: up to three on the lock screen, two in the island. */
  actions: LiveChip[];
  islandActions: LiveChip[];
}

const MOST_DOTS = 8;

/** "1:05:12" past an hour, "31:40" before: Swift's `clockText`, the app's `workoutClock`. */
export function liveClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** Which face the phone shows at `now` (Swift's `Phase`, Java's `Phase`). */
export function livePhase(state: RestLiveState, now: number): LivePhase {
  if (state.restEndsAt !== null) {
    return state.restEndsAt <= now ? LivePhases.Go : LivePhases.Rest;
  }
  return state.clockFrom !== null ? LivePhases.Workout : LivePhases.Paused;
}

const joined = (parts: readonly string[]): string => parts.filter(Boolean).join(' · ');
const or = (value: string, fallback: string): string => value || fallback;

/** The Live Activity at `now`: a port of `Face`, `RichView`, `NextLine` and `Actions`. */
export function liveFace(state: RestLiveState, now: number): LiveFace {
  const phase = livePhase(state, now);
  const labels = state.labels;
  const hasPieces = state.exercise !== '';
  const isSuperset = state.order !== '';
  const resting = phase === LivePhases.Rest;
  const inRest = resting || phase === LivePhases.Go;
  const end = state.restEndsAt ?? now;
  const start = Math.min(state.restStartedAt ?? end, end);

  const kicker = {
    [LivePhases.Rest]: state.kicker || labels.rest,
    [LivePhases.Go]: labels.restOver,
    [LivePhases.Workout]: joined([state.title, labels.workout]),
    [LivePhases.Paused]: joined([state.title, labels.paused]),
  }[phase];

  let big: string;
  let over = '';
  let compact: string;
  switch (phase) {
    case LivePhases.Rest:
      big = liveClock(Math.ceil((end - now) / 1000));
      compact = big;
      break;
    case LivePhases.Go:
      big = or(labels.done, labels.go);
      over = `+${liveClock((now - end) / 1000)}`;
      compact = '✓';
      break;
    case LivePhases.Workout:
      big = liveClock((now - (state.clockFrom ?? now)) / 1000);
      compact = big;
      break;
    default:
      big = liveClock(state.pausedSeconds ?? 0);
      compact = big;
  }

  const theSet = isSuperset ? state.order : joined([state.exercise, state.set, state.target]);
  const nextLabel = labels.next;
  const oneLine = {
    [LivePhases.Rest]: hasPieces ? `${nextLabel}: ${theSet}` : state.restLine,
    [LivePhases.Go]: hasPieces ? theSet : state.goLine,
    [LivePhases.Workout]: hasPieces ? joined([state.set, state.progress]) : state.workoutLine,
    [LivePhases.Paused]: labels.paused,
  }[phase];
  const prefix = resting ? `${nextLabel}: ` : '';
  // No pieces sent (an app that never opened the logger): the one-line texts.
  const plainOnly = !hasPieces;
  const nextLine = {
    shown: hasPieces || oneLine !== '',
    plain: plainOnly ? oneLine : '',
    lead: plainOnly ? '' : prefix + (isSuperset ? state.order : state.exercise),
    set: plainOnly || isSuperset ? '' : state.set,
    target: plainOnly || isSuperset || !inRest ? '' : state.target,
  };

  let detail = '';
  if (hasPieces) {
    detail = inRest ? (isSuperset ? '' : state.last) : joined([state.aim, state.last]);
  }

  const dots: DotState[] = [];
  let dotsText = '';
  if (state.total > MOST_DOTS) {
    dotsText = `${Math.min(state.done + 1, state.total)}/${state.total}`;
  } else {
    for (let index = 0; index < state.total; index++) {
      if (index < state.done) dots.push(DotStates.Done);
      else if (index === state.done) dots.push(DotStates.Next);
      else dots.push(DotStates.Todo);
    }
  }

  let restLeft: number | null = null;
  if (resting) {
    restLeft = end > start ? Math.min(1, Math.max(0, (end - now) / (end - start))) : 0;
  }

  return {
    phase,
    kicker,
    big,
    over,
    aside: resting ? state.planned : phase === LivePhases.Go ? '' : state.progress,
    restLeft,
    nextLine,
    detail,
    dots,
    dotsText,
    compact,
    actions: liveActions(state, phase, 3),
    islandActions: liveActions(state, phase, 2),
  };
}

/**
 * Every face's buttons, the main one in honey (Swift's `Actions`). Resting:
 * −15, +15, Skip. Rest over: Start set, +30 s, ✓ the next set. Between
 * sets: ✓, Other value, Skip set. Paused: Continue.
 */
function liveActions(state: RestLiveState, phase: LivePhase, limit: number): LiveChip[] {
  const labels = state.labels;
  const step = state.steps.length > 0 ? state.steps[0] : null;
  const canLog = !!step && Object.keys(step.values).length > 0 && step.short !== '';
  const log = step ? `✓ ${step.short}` : '';
  const chips: LiveChip[] = [];
  const add = (text: string, primary = false) => {
    if (text) chips.push({ text, primary });
  };
  // The nudges and the tick are drawn in the Swift, not sent as labels.
  switch (phase) {
    case LivePhases.Rest:
      if (limit >= 3) add('−15');
      add('+15');
      add(labels.skip);
      break;
    case LivePhases.Go:
      add(labels.startSet, true);
      // "+30 s" gives way to ✓ where only two fit.
      if (limit >= 3 || !canLog) add(labels.more);
      if (canLog) add(log);
      break;
    case LivePhases.Workout:
      if (!step) break;
      if (canLog) add(log, true);
      add(limit >= 3 ? labels.otherValue : labels.open, !canLog);
      if (limit >= 3) add(labels.skipSet);
      break;
    default:
      add(labels.resume, true);
  }
  return chips;
}

/** The ongoing notification (`RestLive.java`, `render`). */
export interface AndroidLiveFace {
  phase: LivePhase;
  /** Beside the app's name in the header. */
  sub: string;
  /** Bold, before the clock: "Go", "Push day · ", "Push day · 23:00". */
  title: string;
  /** The system's Chronometer: "01:02", counting down or up; empty when hidden. */
  clock: string;
  line: string;
  /** The rest left, under the line; null when hidden. */
  progress: number | null;
  actions: string[];
}

/** "01:05", "1:01:05": Android's `DateUtils.formatElapsedTime`, as a Chronometer shows it. */
export function chronometer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

export function androidLiveFace(state: RestLiveState, now: number): AndroidLiveFace {
  const labels = state.labels;
  const end = state.restEndsAt ?? 0;
  const start = state.restStartedAt ?? end;
  if (end > 0 && now < end) {
    return {
      phase: LivePhases.Rest,
      sub: labels.rest,
      title: '',
      clock: chronometer(Math.ceil((end - now) / 1000)),
      line: state.workoutLine,
      progress: Math.min(1, (end - now) / Math.max(1, end - Math.min(start, end))),
      actions: [labels.plus, labels.skip, labels.open],
    };
  }
  if (end > 0 && now < end + OVERTIME_CEILING_SECONDS * 1000) {
    return {
      phase: LivePhases.Go,
      sub: labels.restOver,
      title: labels.go,
      clock: '',
      line: state.goLine,
      progress: null,
      actions: [labels.startSet, labels.open],
    };
  }
  if (state.clockFrom !== null) {
    return {
      phase: LivePhases.Workout,
      sub: labels.workout,
      title: `${state.title} · `,
      clock: chronometer((now - state.clockFrom) / 1000),
      line: state.workoutLine,
      progress: null,
      actions: [labels.open],
    };
  }
  return {
    phase: LivePhases.Paused,
    sub: labels.workout,
    title: `${state.title} · ${liveClock(state.pausedSeconds ?? 0)}`,
    clock: '',
    line: labels.paused,
    progress: null,
    actions: [labels.open],
  };
}
