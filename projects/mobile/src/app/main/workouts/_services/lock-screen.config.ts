import { RestLiveState } from '../../../_shared/native/rest-live';
import { OVERTIME_CEILING_SECONDS } from '../_components/rest-timer-bar/rest-timer-bar';
import { secondsToClock, workoutElapsedSeconds } from '../workouts.config';
import { ActiveRest, ActiveSession, LiveNext } from './active-session.store';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** The +15 on the lock screen, the same as the rest bar's. */
const NUDGE_SECONDS = 15;
/** "+30 s" once the rest is over: a little more, counted from then. */
const MORE_REST_SECONDS = 30;

/**
 * What the lock screen shows for the workout in progress, from the same
 * timestamps the mini-bar reads. The rest counts only while it is still one
 * (until ten minutes over, as in the app); a paused workout shows its time
 * standing still. `live` is the next set in pieces, for the iOS layouts;
 * without it they fall back on the one-line texts.
 */
export function liveState(
  session: ActiveSession,
  rest: ActiveRest | null,
  next: string,
  translate: Translate,
  now: number,
  live: LiveNext | null = null,
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
    ...nextPieces(live, translate),
    planned: plannedLine(resting ? rest : null, translate),
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
      channel: translate('workouts.activeBar.inProgress'),
    },
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

/** "of 2:00", beside the countdown: the rest as it was planned. */
function plannedLine(rest: ActiveRest | null, translate: Translate): string {
  if (!rest || rest.planned <= 0) {
    return '';
  }
  return translate('workouts.live.planned', { total: secondsToClock(rest.planned) });
}
