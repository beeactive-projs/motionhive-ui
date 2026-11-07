import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

/**
 * The app's own native plugin for the workout on the lock screen (Workouts
 * R2, Active Workout, "Outside the app"): a Live Activity with the Dynamic
 * Island on iOS, an ongoing notification on Android. Both show the rest
 * counting down with +15 and Skip (iOS adds −15), Go with Start set at zero
 * (iOS adds +30 s), and the workout's clock between sets. On iOS the next
 * set comes in pieces: exercise, set, weight, last time, the set dots. The
 * system keeps their time from the dates given here, so nothing has to run
 * while the phone is locked.
 *
 * Native code: `ios/App/App/RestLivePlugin.swift` with the
 * `RestTimerExtension` target (`ios/App/RestTimer/`), and
 * `android/app/src/main/java/fit/motionhive/app/RestLive*.java`. The
 * browser build gets `rest-live.web.ts`, where nothing shows.
 *
 * The buttons work with the app asleep: they change what is shown, move or
 * withdraw the rest-over alert, and leave a note. `takeActions` hands the
 * notes over once; the `action` event says there are some while the app runs.
 */
export interface RestLivePlugin {
  /** Whether the phone shows it (Live Activities allowed, notifications on). */
  isAvailable(): Promise<{ available: boolean }>;
  /** Starts it for this workout, or brings it up to date. */
  show(state: RestLiveState): Promise<void>;
  /** Finished, discarded, closed or turned off: it goes at once. */
  end(): Promise<void>;
  /** What the buttons did since the last call, oldest first. */
  takeActions(): Promise<{ actions: RestLiveAction[] }>;
  addListener(event: 'action', listener: () => void): Promise<PluginListenerHandle>;
}

/** Times are epoch milliseconds; null where there is none. */
export interface RestLiveState {
  logId: string;
  /** The workout's name. */
  title: string;
  /** The rest running; both null between sets. */
  restStartedAt: number | null;
  restEndsAt: number | null;
  /** The workout clock counts up from here; null while paused. */
  clockFrom: number | null;
  /** What the clock says while paused, in seconds. */
  pausedSeconds: number | null;
  /** "Rest · next Set 3 · Bench press", under the countdown (iOS). */
  restLine: string;
  /** "Set 3 · 62.5 kg × 8 · Bench press", under Go. */
  goLine: string;
  /** "Next: Set 3 · Bench press", under the workout clock and the Android countdown. */
  workoutLine: string;
  /**
   * "Bench press": the next set, in pieces from here to `order`, for the iOS
   * layouts, which cut the name before the weight. Empty (and 0) when the
   * logger has not said; they then fall back on the lines above.
   */
  exercise: string;
  /** "Set 2", "Warm-up", "Round 2". */
  set: string;
  /** "62.5 kg × 8". */
  target: string;
  /** "Target 62.5 kg × 8", between sets. */
  aim: string;
  /** "last time 60 × 8". */
  last: string;
  /** Sets of this exercise ticked, of how many (rounds, in a superset): the dots. */
  done: number;
  total: number;
  /** "7 of 13 sets", beside the workout clock. */
  progress: string;
  /** "of 2:00", beside the countdown. */
  planned: string;
  /** In a superset: "Superset · round 2 of 3", and the round in order. */
  kicker: string;
  order: string;
  labels: RestLiveLabels;
}

/** The words on it, in the person's language. */
export interface RestLiveLabels {
  rest: string;
  restOver: string;
  workout: string;
  go: string;
  /** "Done", where the countdown was (iOS). */
  done: string;
  /** "Next", before the set to do. */
  next: string;
  skip: string;
  startSet: string;
  /** "+15 s" (Android; iOS shows "+15"). */
  plus: string;
  /** "+30 s", once the rest is over (iOS). */
  more: string;
  open: string;
  paused: string;
  /** The Android notification channel, as Settings lists it. */
  channel: string;
}

export const RestLiveActionTypes = {
  /** +15: `endsAt` is the rest's new end. */
  Extend: 'extend',
  /** Skip, before zero. */
  Skip: 'skip',
  /** Start set, from zero on. */
  Start: 'start',
} as const;

export type RestLiveActionType = (typeof RestLiveActionTypes)[keyof typeof RestLiveActionTypes];

export interface RestLiveAction {
  type: RestLiveActionType;
  /** When the button was tapped. */
  at: number;
  endsAt?: number;
}

export const RestLive = registerPlugin<RestLivePlugin>('RestLive', {
  web: () => import('./rest-live.web').then((module) => new module.RestLiveWeb()),
});
