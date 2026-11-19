import { barbellOutline, pauseOutline, timerOutline, trophyOutline } from 'ionicons/icons';

import { WorkoutLog } from 'core';

import { HexMeterPhase, HexMeterPhases } from '../_components/hex-meter/hex-meter';
import { OVERTIME_CEILING_SECONDS } from '../_components/rest-timer-bar/rest-timer-bar';
import { secondsToClock } from '../workouts.config';
import { ActiveRest, ActiveSession, LiveNext, SetProgress } from './active-session.store';

/** What a status and a clock need of a workout: the store's copy or the API's. */
export type ActiveClock = Pick<WorkoutLog, 'id' | 'startedAt' | 'pausedAt' | 'pausedSeconds'>;

/** The rest, while it still counts as one (ten minutes of overtime at most). */
export interface ActiveRestStatus {
  /** Seconds still to go; below zero once it is over. */
  left: number;
  /** How long it runs, from its start to its end (nudges included), in seconds. */
  planned: number;
  /** "Set 3 · 62.5 kg × 8 · Bench press". */
  next: string;
}

/**
 * What a screen outside the logger shows of the workout in progress: the
 * mini-bar and the resume card read this one answer, so they never disagree.
 */
export interface ActiveStatus {
  /** What the ring shows. */
  phase: HexMeterPhase;
  /** The glyph in the ring (Over draws its own tick). */
  icon: string;
  rest: ActiveRestStatus | null;
  /** The rest still to go, as a share of the planned (0 to 1). */
  share: number;
  /** The rest's own clock: "1:05" counting down, "+0:53" once over; empty without a rest. */
  restClock: string;
}

/**
 * Every glyph `activeStatus` puts in the ring, for each surface that shows
 * one to register: the mini-bar renders on every tab, before the Workouts
 * page has registered `WORKOUT_ICONS`. Over draws its own tick (`HexMeter`).
 */
export const ACTIVE_STATUS_ICONS = { barbellOutline, pauseOutline, timerOutline, trophyOutline };

const NO_REST = { rest: null, share: 0, restClock: '' } as const;

/**
 * The status of `session` at `now`. A paused workout has no rest running;
 * a rest counts only for its own workout, and only until ten minutes over,
 * as on the lock screen (`liveState`). `allDone`: every set is ticked (the
 * store's `allDone`), which shows once no rest is counting.
 */
export function activeStatus(
  session: Pick<ActiveClock, 'id' | 'pausedAt'> | null,
  rest: ActiveRest | null,
  now: number,
  allDone = false,
): ActiveStatus {
  if (session?.pausedAt) {
    return { phase: HexMeterPhases.Paused, icon: 'pause-outline', ...NO_REST };
  }
  const counted = countedRest(session, rest, now);
  if (!counted && allDone && session) {
    return { phase: HexMeterPhases.Done, icon: 'trophy-outline', ...NO_REST };
  }
  if (!counted) {
    return { phase: HexMeterPhases.Workout, icon: 'barbell-outline', ...NO_REST };
  }
  const { left, planned } = counted;
  if (left > 0) {
    return {
      phase: HexMeterPhases.Rest,
      icon: 'timer-outline',
      rest: counted,
      share: planned > 0 ? Math.min(1, left / planned) : 0,
      restClock: secondsToClock(Math.ceil(left)),
    };
  }
  return {
    phase: HexMeterPhases.Over,
    icon: 'timer-outline',
    rest: counted,
    share: 0,
    restClock: `+${secondsToClock(Math.floor(-left))}`,
  };
}

/** A key and its params, for the template or `instant()` to translate. */
export interface ActiveWords {
  key: string;
  params: Record<string, string | number>;
}

/**
 * How the workout stands, in words: the resume card's line under the name,
 * and the mini-bar's name for a screen reader. "Workout · 23:00 · 7 of 13
 * sets", "Rest · 1:02 of 1:30", "Rest over" (then "Rest over · +0:25 over"
 * from the first whole second), "Paused · 23:00", "All sets done · 52:00".
 * `elapsed` is the workout's clock, as `workoutClock` says it; `progress`,
 * once the logger has counted the sets, adds the count between sets.
 */
export function statusWords(
  status: ActiveStatus,
  elapsed: string,
  progress: SetProgress | null = null,
): ActiveWords {
  switch (status.phase) {
    case HexMeterPhases.Rest:
      return {
        key: 'workouts.home.resting',
        params: { left: status.restClock, planned: secondsToClock(status.rest?.planned ?? 0) },
      };
    case HexMeterPhases.Over:
      return Math.floor(-(status.rest?.left ?? 0)) > 0
        ? { key: 'workouts.home.restOvertime', params: { over: status.restClock } }
        : { key: 'workouts.home.restOver', params: {} };
    case HexMeterPhases.Paused:
      return { key: 'workouts.home.paused', params: { elapsed } };
    case HexMeterPhases.Done:
      return { key: 'workouts.home.allDone', params: { elapsed } };
    default:
      return progress && progress.total > 0
        ? {
            key: 'workouts.home.workoutSets',
            params: { elapsed, done: progress.done, total: progress.total },
          }
        : { key: 'workouts.home.workout', params: { elapsed } };
  }
}

/**
 * What the mini-bar says comes next (Hex meter design): "Next: Bench press ·
 * Set 3", or "Next: round 2 of 3" in a superset. `step` is the store's first
 * step; without one, `line` (the logger's whole "Set 3 · 62.5 kg × 8 · Bench
 * press") stands in. Null when nothing is known to come.
 */
export function nextWords(step: LiveNext | null, line: string): ActiveWords | null {
  if (step?.round && step.total > 0) {
    return { key: 'workouts.activeBar.nextRound', params: { round: step.round, total: step.total } };
  }
  if (step?.exercise) {
    return { key: 'workouts.activeBar.nextSet', params: { exercise: step.exercise, set: step.set } };
  }
  if (line) {
    return { key: 'workouts.live.next', params: { next: line } };
  }
  return null;
}

/**
 * The open workout's clock, as fresh as the phone knows it: the store's copy
 * (what the logger last said, and the mini-bar shows) over the API's answer,
 * which can lag a pause or a resume still on its way. The API's when the
 * store holds another workout or none yet.
 */
export function freshestClock(
  log: WorkoutLog | null,
  session: ActiveSession | null,
): ActiveClock | null {
  if (!log) {
    return null;
  }
  if (session && session.id === log.id) {
    return session;
  }
  return log;
}

function countedRest(
  session: Pick<ActiveClock, 'id'> | null,
  rest: ActiveRest | null,
  now: number,
): ActiveRestStatus | null {
  if (!session || !rest || rest.logId !== session.id || rest.endsAt === null) {
    return null;
  }
  const left = (rest.endsAt - now) / 1000;
  if (left < -OVERTIME_CEILING_SECONDS) {
    return null;
  }
  // Measured from its start to its end, as the rest bar and the lock screen
  // measure it: a ±15 s nudge moves only the end, and `rest.planned` keeps
  // what it was set to (the break detection reads that).
  const planned = Math.max(0, Math.round((rest.endsAt - rest.startedAt) / 1000));
  return { left, planned, next: rest.next };
}
