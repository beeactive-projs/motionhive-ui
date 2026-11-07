import { RestLiveAction, RestLiveState, RestLiveStep } from '../../../_shared/native/rest-live';
import { OVERTIME_CEILING_SECONDS } from '../_components/rest-timer-bar/rest-timer-bar';
import { PAYLOAD_KEY, PayloadKey } from '../logger/logger-flow';
import { secondsToClock, workoutElapsedSeconds } from '../workouts.config';
import { ActiveRest, ActiveSession, LiveNext, LiveStep, LiveValues } from './active-session.store';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** The +15 on the lock screen, the same as the rest bar's. */
const NUDGE_SECONDS = 15;
/** "+30 s" once the rest is over: a little more, counted from then. */
const MORE_REST_SECONDS = 30;
/**
 * What the steps may take of the Live Activity, in bytes: iOS refuses a
 * state over 4 KB, and the rest of it (the texts, the words) takes about
 * one. Steps past it are left out; the lock screen then knows fewer ahead.
 */
export const STEPS_BUDGET_BYTES = 2400;

/** The values ✓ may save, and nothing else: the columns a set's fields write to. */
const VALUE_KEYS: readonly PayloadKey[] = Object.values(PAYLOAD_KEY);

/**
 * What the lock screen shows for the workout in progress, from the same
 * timestamps the mini-bar reads. The rest counts only while it is still one
 * (until ten minutes over, as in the app); a paused workout shows its time
 * standing still. `steps` are the next sets in pieces, for the iOS layouts
 * and their buttons; without them they fall back on the one-line texts.
 */
export function liveState(
  session: ActiveSession,
  rest: ActiveRest | null,
  next: string,
  translate: Translate,
  now: number,
  steps: readonly LiveStep[] = [],
): RestLiveState {
  const paused = !!session.pausedAt;
  const resting =
    !paused &&
    rest !== null &&
    rest.logId === session.id &&
    rest.endsAt !== null &&
    now < rest.endsAt + OVERTIME_CEILING_SECONDS * 1000;
  const upNext = (resting ? rest.next : '') || next;
  let first: LiveStep | null = null;
  if (steps.length > 0) {
    first = steps[0];
  }
  return {
    logId: session.id,
    title: session.name,
    restStartedAt: resting ? rest.startedAt : null,
    restEndsAt: resting ? rest.endsAt : null,
    clockFrom: paused ? null : new Date(session.startedAt).getTime() + session.pausedSeconds * 1000,
    pausedSeconds: paused ? workoutElapsedSeconds(session, now) : null,
    restLine: upNext
      ? translate('workouts.activeBar.resting', { next: upNext })
      : translate('workouts.restTimer.rest'),
    goLine: upNext || translate('workouts.restTimer.restOver'),
    workoutLine: upNext ? translate('workouts.live.next', { next: upNext }) : '',
    ...nextPieces(first, translate),
    planned: plannedLine(resting ? rest : null, translate),
    steps: fitSteps(steps.map((step) => liveStep(step, translate))),
    labels: {
      rest: translate('workouts.restTimer.rest'),
      restOver: translate('workouts.restTimer.restOver'),
      workout: translate('workouts.live.workout'),
      go: translate('workouts.restTimer.go'),
      done: translate('workouts.live.done'),
      next: translate('workouts.restTimer.next'),
      skip: translate('button.skip'),
      startSet: translate('workouts.restTimer.startSet'),
      plus: translate('workouts.live.plus', { seconds: NUDGE_SECONDS }),
      more: translate('workouts.live.plus', { seconds: MORE_REST_SECONDS }),
      open: translate('button.open'),
      paused: translate('workouts.activeBar.paused'),
      skipSet: translate('workouts.live.skipSet'),
      otherValue: translate('workouts.live.otherValue'),
      resume: translate('button.continue'),
      allDone: translate('workouts.live.allDone'),
      alertTitle: translate('workouts.restAlert.title'),
      alertBody: translate('workouts.restAlert.body'),
      channel: translate('workouts.activeBar.inProgress'),
    },
  };
}

/**
 * The values a ✓ note carries, as numbers the API takes: anything else the
 * phone handed back is dropped.
 */
export function liveValues(raw: Record<string, unknown> | null | undefined): LiveValues {
  const values: LiveValues = {};
  if (!raw) {
    return values;
  }
  for (const key of VALUE_KEYS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      values[key] = value;
    }
  }
  return values;
}

/**
 * Whether a ✓ note is for the set the lock screen shows next. One for any
 * other set was handed over twice, or is for a set already moved past.
 * With no sets ahead kept, nothing tells them apart: it counts as next.
 */
export function isNextStep(steps: readonly LiveStep[], setId: string): boolean {
  if (steps.length === 0) {
    return true;
  }
  return steps[0].setId === setId;
}

/**
 * The rest a ✓ on the lock screen started, as the lock screen started it:
 * the step's own rest when the app knows the step, else the end the note
 * carries (the app restarted without the sets ahead). Null when none started.
 */
export function liveTickRest(
  logId: string,
  action: RestLiveAction,
  step: LiveStep | null,
  next: string,
): ActiveRest | null {
  const setId = action.setId;
  if (!setId) {
    return null;
  }
  if (step) {
    if (step.rest === null) {
      return null;
    }
    return {
      logId,
      exerciseId: step.exerciseId,
      setId,
      startedAt: action.at,
      endsAt: action.at + step.rest * 1000,
      planned: step.rest,
      next,
    };
  }
  const endsAt = action.endsAt;
  const exerciseId = action.exerciseId;
  if (endsAt === undefined || !exerciseId || endsAt <= action.at) {
    return null;
  }
  return {
    logId,
    exerciseId,
    setId,
    startedAt: action.at,
    endsAt,
    planned: Math.round((endsAt - action.at) / 1000),
    next,
  };
}

type NextPieces = Pick<
  RestLiveState,
  'exercise' | 'set' | 'target' | 'aim' | 'last' | 'done' | 'total' | 'progress' | 'kicker' | 'order'
>;

/** The next set laid out in pieces; all empty when the logger has not said. */
function nextPieces(live: LiveNext | null, translate: Translate): NextPieces {
  if (!live) {
    return {
      exercise: '',
      set: '',
      target: '',
      aim: '',
      last: '',
      done: 0,
      total: 0,
      progress: '',
      kicker: '',
      order: '',
    };
  }
  let aim = '';
  if (live.target) {
    aim = translate('workouts.live.target', { value: live.target });
  }
  let progress = '';
  if (live.workoutTotal > 0) {
    progress = translate('workouts.live.progress', { done: live.workoutDone, total: live.workoutTotal });
  }
  return {
    exercise: live.exercise,
    set: live.set,
    target: live.target,
    aim,
    last: live.last,
    done: live.done,
    total: live.total,
    progress,
    kicker: live.kicker,
    order: live.order,
  };
}

function liveStep(step: LiveStep, translate: Translate): RestLiveStep {
  return {
    setId: step.setId,
    exerciseId: step.exerciseId,
    values: { ...step.values },
    short: step.short,
    rest: step.rest,
    line: step.line,
    final: step.final,
    ...nextPieces(step, translate),
  };
}

/** As many steps as the budget holds, from the first; always the first. */
function fitSteps(steps: RestLiveStep[]): RestLiveStep[] {
  const encoder = new TextEncoder();
  const kept = [...steps];
  while (kept.length > 1 && encoder.encode(JSON.stringify(kept)).length > STEPS_BUDGET_BYTES) {
    kept.pop();
  }
  return kept;
}

/** "of 2:00", beside the countdown: the rest as it was planned. */
function plannedLine(rest: ActiveRest | null, translate: Translate): string {
  if (!rest || rest.planned <= 0) {
    return '';
  }
  return translate('workouts.live.planned', { total: secondsToClock(rest.planned) });
}
