import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

import type { PayloadKey } from '../logger/logger-flow';

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

/**
 * The set to do next, in pieces, for the lock screen (Live Activity, R
 * layouts): it lays them out itself and cuts the name, never the weight.
 * Every text is already in the person's language.
 */
export interface LiveNext {
  /** "Bench press". */
  exercise: string;
  /** "Set 2", "Warm-up", or "Round 2" in a superset. */
  set: string;
  /** "62.5 kg × 8"; empty when nothing is planned or pre-filled. */
  target: string;
  /** "last time 60 × 8"; empty the first time. */
  last: string;
  /** Sets of this exercise ticked, of how many (rounds, in a superset). */
  done: number;
  total: number;
  /** Sets ticked in the whole workout, of how many. */
  workoutDone: number;
  workoutTotal: number;
  /** In a superset: "Superset · round 2 of 3"; empty otherwise. */
  kicker: string;
  /** In a superset: "A1 Incline press 22 × 10 → A2 Push-ups × 15". */
  order: string;
}

/** What ✓ on the lock screen saves for a set: the values its button shows. */
export type LiveValues = Partial<Record<PayloadKey, number>>;

/**
 * One set to come, for the lock screen: the pieces it shows, and what its
 * buttons need to act with the app asleep. The first is the next set; the
 * ones after it are what the lock screen shows once ✓ or Skip set moved it on.
 */
export interface LiveStep extends LiveNext {
  exerciseId: string;
  setId: string;
  /** What ✓ saves. Empty when nothing is planned or pre-filled: no ✓ then. */
  values: LiveValues;
  /** The same, short, on the ✓ button: "62.5 × 8". */
  short: string;
  /** The rest that starts once it is ticked, in seconds; null when none does. */
  rest: number | null;
  /** "Set 3 · 62.5 kg × 8 · Bench press": the rest-over alert's text. */
  line: string;
  /** Nothing is left to do after it. */
  final: boolean;
}

/** Sets passed over with "Skip set", for one workout. */
interface PassedSets {
  logId: string;
  setIds: string[];
}

/**
 * What comes next in one workout, as the logger last said: kept, so the
 * lock screen keeps its ✓, Other value and Skip set after the app restarts.
 */
interface AheadSets {
  logId: string;
  next: string;
  steps: LiveStep[];
}

const REST_KEY = 'mh-active-rest';
const NO_SETS: ReadonlySet<string> = new Set();
const NO_STEPS: readonly LiveStep[] = [];
const PASSED_KEY = 'mh-passed-sets';
const AHEAD_KEY = 'mh-live-steps';

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
  private readonly _ahead = signal<AheadSets | null>(null);
  /** The last `_ahead` saved, so an unchanged one is not written again. */
  private _aheadSaved = '';
  private readonly _passed = signal<PassedSets | null>(null);
  private readonly _checked = signal(false);
  /** True once what was kept on the phone (rest, passed sets, sets ahead) is back. */
  private readonly _local = signal(false);
  private _restored = false;

  readonly session = this._session.asReadonly();
  readonly rest = this._rest.asReadonly();
  /** What the logger says comes next ("Set 3 · 62.5 kg × 8 · Bench press"), rest or not. */
  readonly next = computed(() => {
    const ahead = this._aheadOfSession();
    if (!ahead) {
      return '';
    }
    return ahead.next;
  });
  /** The sets to come, in pieces, for the lock screen; empty when nothing is left or the logger never opened. */
  readonly liveSteps = computed<readonly LiveStep[]>(() => {
    const ahead = this._aheadOfSession();
    if (!ahead) {
      return NO_STEPS;
    }
    return ahead.steps;
  });
  /** The sets of the running workout passed over with "Skip set": left unticked, and the focus goes past them. */
  readonly passed = computed<ReadonlySet<string>>(() => {
    const passed = this._passed();
    const session = this._session();
    if (!passed || !session || passed.logId !== session.id) {
      return NO_SETS;
    }
    return new Set(passed.setIds);
  });
  /** True once the API has said whether a workout is open: until then, null means unknown. */
  readonly checked = this._checked.asReadonly();
  /**
   * Checked, and what was kept on the phone is back: only then can a note
   * from the lock screen be applied, or the lock screen be redrawn.
   */
  readonly ready = computed(() => this._checked() && this._local());

  constructor() {
    // Each restore keeps its own failures, so this always arrives.
    const restores = [this._restoreRest(), this._restorePassed(), this._restoreAhead()];
    void Promise.all(restores).then(() => this._local.set(true));
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

  /** What comes next in workout `logId`, kept for after a restart. */
  setNext(logId: string, next: string, steps: readonly LiveStep[] = []): void {
    const ahead: AheadSets = { logId, next, steps: [...steps] };
    const saved = JSON.stringify(ahead);
    if (saved === this._aheadSaved) {
      return;
    }
    this._aheadSaved = saved;
    this._ahead.set(ahead);
    void this._save(AHEAD_KEY, ahead);
  }

  /**
   * The lock screen moved on past `setId` (its ✓ or Skip set) while the
   * logger was closed: what comes next is the step after it, as the lock
   * screen already shows.
   */
  moveOnFrom(setId: string): LiveStep | null {
    const ahead = this._aheadOfSession();
    if (!ahead) {
      return null;
    }
    const steps = ahead.steps;
    const at = steps.findIndex((step) => step.setId === setId);
    if (at < 0) {
      return null;
    }
    const rest = steps.slice(at + 1);
    let next = '';
    if (rest.length > 0) {
      next = rest[0].line;
    }
    this.setNext(ahead.logId, next, rest);
    return steps[at];
  }

  /** "Skip set" on the lock screen: the set stays unticked and the focus goes past it. */
  pass(logId: string, setId: string): void {
    const current = this._passed();
    let setIds: string[] = [];
    if (current && current.logId === logId) {
      setIds = current.setIds;
    }
    if (setIds.includes(setId)) {
      return;
    }
    const passed = { logId, setIds: [...setIds, setId] };
    this._passed.set(passed);
    void this._save(PASSED_KEY, passed);
  }

  setRest(rest: ActiveRest | null): void {
    this._rest.set(rest);
    void this._persist(rest);
  }

  /** Finished or discarded: nothing is running any more. */
  end(): void {
    this._checked.set(true);
    this._session.set(null);
    this._ahead.set(null);
    this._aheadSaved = '';
    void this._save(AHEAD_KEY, null);
    this.setRest(null);
    this._passed.set(null);
    void this._save(PASSED_KEY, null);
  }

  /** The sets ahead, when they are the running workout's. */
  private _aheadOfSession(): AheadSets | null {
    const ahead = this._ahead();
    const session = this._session();
    if (!ahead || !session || ahead.logId !== session.id) {
      return null;
    }
    return ahead;
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
    await this._save(REST_KEY, rest);
  }

  private async _restorePassed(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: PASSED_KEY });
      if (!value || this._passed()) {
        return;
      }
      const passed = JSON.parse(value) as PassedSets;
      if (passed && typeof passed.logId === 'string' && Array.isArray(passed.setIds)) {
        this._passed.set(passed);
      }
    } catch {
      // Nothing to restore: the focus is simply the first set left.
    }
  }

  private async _restoreAhead(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: AHEAD_KEY });
      if (!value || this._ahead()) {
        return;
      }
      const ahead = JSON.parse(value) as AheadSets;
      const valid =
        !!ahead &&
        typeof ahead.logId === 'string' &&
        typeof ahead.next === 'string' &&
        Array.isArray(ahead.steps);
      if (valid) {
        this._ahead.set(ahead);
      }
    } catch {
      // Nothing to restore: the lock screen shows the next set once the logger opens.
    }
  }

  private async _save(key: string, value: unknown): Promise<void> {
    try {
      if (value) {
        await Preferences.set({ key, value: JSON.stringify(value) });
      } else {
        await Preferences.remove({ key });
      }
    } catch {
      // Storage refused: it still holds while the app is open.
    }
  }
}
