import { RestLiveState } from '../../../_shared/native/rest-live';
import { OVERTIME_CEILING_SECONDS } from '../_components/rest-timer-bar/rest-timer-bar';
import { workoutElapsedSeconds } from '../workouts.config';
import { ActiveRest, ActiveSession } from './active-session.store';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** The +15 on the lock screen, the same as the rest bar's. */
const NUDGE_SECONDS = 15;

/**
 * What the lock screen shows for the workout in progress, from the same
 * timestamps the mini-bar reads. The rest counts only while it is still one
 * (until ten minutes over, as in the app); a paused workout shows its time
 * standing still.
 */
export function liveState(
  session: ActiveSession,
  rest: ActiveRest | null,
  next: string,
  translate: Translate,
  now: number,
): RestLiveState {
  const paused = !!session.pausedAt;
  const resting =
    !paused &&
    rest !== null &&
    rest.logId === session.id &&
    rest.endsAt !== null &&
    now < rest.endsAt + OVERTIME_CEILING_SECONDS * 1000;
  const upNext = (resting ? rest.next : '') || next;
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
    labels: {
      rest: translate('workouts.restTimer.rest'),
      restOver: translate('workouts.restTimer.restOver'),
      workout: translate('workouts.live.workout'),
      go: translate('workouts.restTimer.go'),
      skip: translate('button.skip'),
      startSet: translate('workouts.restTimer.startSet'),
      plus: translate('workouts.live.plus', { seconds: NUDGE_SECONDS }),
      open: translate('button.open'),
      paused: translate('workouts.activeBar.paused'),
      channel: translate('workouts.activeBar.inProgress'),
    },
  };
}
