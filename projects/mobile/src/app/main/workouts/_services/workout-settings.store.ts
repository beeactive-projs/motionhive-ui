import { Service, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';

import {
  DEFAULT_WORKOUT_SETTINGS,
  UpdateWorkoutSettingsPayload,
  WorkoutSettings,
  WorkoutSettingsService,
} from 'core';

/**
 * The person's logger settings, loaded once and kept for the session.
 * Until they arrive (or if they never do), the API's defaults apply, so the
 * logger never waits on them.
 */
@Service()
export class WorkoutSettingsStore {
  private readonly _service = inject(WorkoutSettingsService);
  private readonly _settings = signal<WorkoutSettings>(DEFAULT_WORKOUT_SETTINGS);
  private _loaded = false;

  readonly settings = this._settings.asReadonly();

  /** Once per session; later calls do nothing. */
  load(): void {
    if (this._loaded) return;
    this._loaded = true;
    this._service
      .get()
      .pipe(take(1))
      .subscribe({
        next: (settings) => this._settings.set(settings),
        error: () => (this._loaded = false),
      });
  }

  /** Shown at once; put back if the save fails. */
  update(patch: UpdateWorkoutSettingsPayload, onError?: () => void): void {
    const before = this._settings();
    this._settings.set({ ...before, ...withoutNulls(patch) });
    this._service
      .update(patch)
      .pipe(take(1))
      .subscribe({
        next: (saved) => this._settings.set(saved),
        error: () => {
          this._settings.set(before);
          onError?.();
        },
      });
  }
}

function withoutNulls(patch: UpdateWorkoutSettingsPayload): Partial<WorkoutSettings> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<WorkoutSettings>;
}
