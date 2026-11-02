/**
 * The person's logger settings (Settings › Workouts). The API fills every
 * key, with its default where the person never chose.
 */
export interface WorkoutSettings {
  /** Rest when neither the plan nor the routine sets one: 15 to 600 s. */
  defaultRestSeconds: number;
  /** A short chime when rest ends, while the app is open. */
  sound: boolean;
  /** A tap at ten seconds to go and a buzz at zero. */
  vibration: boolean;
  /** The rest on the lock screen. */
  lockScreen: boolean;
  /** "How hard?" after every set, not only where the plan sets a target. */
  askEffort: boolean;
  /** In a superset, go straight to the next exercise of the round. */
  supersetJump: boolean;
  /** Keep the screen on during a workout. */
  keepScreenOn: boolean;
}

/** What the app assumes before the settings load, the API's defaults. */
export const DEFAULT_WORKOUT_SETTINGS: WorkoutSettings = {
  defaultRestSeconds: 90,
  sound: true,
  vibration: true,
  lockScreen: true,
  askEffort: false,
  supersetJump: true,
  keepScreenOn: true,
};

/** Any subset; a key sent as null goes back to its default. */
export type UpdateWorkoutSettingsPayload = {
  [K in keyof WorkoutSettings]?: WorkoutSettings[K] | null;
};
