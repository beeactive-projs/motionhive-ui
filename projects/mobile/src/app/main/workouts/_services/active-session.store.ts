import { DestroyRef, Service, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

/** The running workout, as much as a screen outside the logger needs. */
export interface ActiveSession {
  id: string;
  name: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
}

/**
 * The rest running now: when it began and ends, after which set, and what
 * comes next. Kept here rather than in the logger page, so it carries on
 * when the workout is minimised and comes back after the app was closed.
 */
export interface ActiveRest {
  logId: string;
  exerciseId: string;
  setId: string;
  startedAt: number;
  /** Null once the bar was hidden: the rest is still measured at the next tick. */
  endsAt: number | null;
  planned: number;
  /** "Set 3 · 62.5 kg × 8 · Bench press". */
  next: string;
}

const REST_KEY = 'mh-active-rest';

/**
 * The workout in progress, across the app (Workouts R2, section 13). Nothing
 * here runs a clock: every screen works its time out from the timestamps,
 * so the app can be closed or the phone restarted and still be right.
 *
 * The logger writes; the mini-bar and the Workouts tab read.
 */
@Service()
export class ActiveSessionStore {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _session = signal<ActiveSession | null>(null);
  private readonly _rest = signal<ActiveRest | null>(null);
  private readonly _next = signal('');
  private readonly _checked = signal(false);
  private _restored = false;

  readonly session = this._session.asReadonly();
  readonly rest = this._rest.asReadonly();
  /** What the logger says comes next ("Set 3 · 62.5 kg × 8 · Bench press"), rest or not. */
  readonly next = this._next.asReadonly();
  /** True once the API has said whether a workout is open: until then, null means unknown. */
  readonly checked = this._checked.asReadonly();

  constructor() {
    void this._restoreRest();
    this.refresh();
    if (Capacitor.isNativePlatform()) {
      const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) this.refresh();
      });
      this._destroyRef.onDestroy(() => void listener.then((handle) => handle.remove()));
    }
  }

  /** Ask the API whether a workout is open; it may have closed elsewhere or overnight. */
  refresh(): void {
    this._workoutLogService
      .getInProgress({ silent: true })
      .pipe(
        take(1),
        catchError(() => of(undefined)),
      )
      .subscribe((log) => {
        if (log === undefined) return;
        // Only a real workout shows: anything else means nothing is open.
        if (log && typeof log.id === 'string' && log.startedAt) this.track(log);
        else this.end();
      });
  }

  /** The logger's workout, whenever it loads or its clock changes. */
  track(log: Pick<WorkoutLog, 'id' | 'name' | 'startedAt' | 'pausedAt' | 'pausedSeconds' | 'status'>): void {
    if (log.status && log.status !== WorkoutLogStatus.InProgress) {
      if (this._session()?.id === log.id) this.end();
      return;
    }
    this._session.set({
      id: log.id,
      name: log.name,
      startedAt: log.startedAt,
      pausedAt: log.pausedAt ?? null,
      pausedSeconds: log.pausedSeconds ?? 0,
    });
    this._checked.set(true);
    const rest = this._rest();
    if (rest && rest.logId !== log.id) this.setRest(null);
  }

  setNext(next: string): void {
    this._next.set(next);
  }

  setRest(rest: ActiveRest | null): void {
    this._rest.set(rest);
    void this._persist(rest);
  }

  /** Finished or discarded: nothing is running any more. */
  end(): void {
    this._checked.set(true);
    this._session.set(null);
    this._next.set('');
    this.setRest(null);
  }

  private async _restoreRest(): Promise<void> {
    if (this._restored) return;
    this._restored = true;
    try {
      const { value } = await Preferences.get({ key: REST_KEY });
      if (!value || this._rest()) return;
      const rest = JSON.parse(value) as ActiveRest;
      if (rest && typeof rest.startedAt === 'number') this._rest.set(rest);
    } catch {
      // Nothing to restore: the next tick starts a new rest anyway.
    }
  }

  private async _persist(rest: ActiveRest | null): Promise<void> {
    try {
      if (rest) await Preferences.set({ key: REST_KEY, value: JSON.stringify(rest) });
      else await Preferences.remove({ key: REST_KEY });
    } catch {
      // Storage refused: the rest still runs while the app is open.
    }
  }
}
