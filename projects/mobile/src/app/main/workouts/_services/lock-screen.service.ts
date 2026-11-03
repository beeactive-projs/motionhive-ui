import { DestroyRef, Service, effect, inject, signal, untracked } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import { WorkoutLogService } from 'core';

import {
  RestLive,
  RestLiveAction,
  RestLiveActionTypes,
  RestLiveState,
} from '../../../_shared/native/rest-live';
import { tappedRest } from '../logger/logger-flow';
import { ActiveSessionStore } from './active-session.store';
import { liveState } from './lock-screen.config';
import { WorkoutSettingsStore } from './workout-settings.store';

/** Who applies the lock screen's buttons while the logger is open. */
export type LockScreenHandler = (action: RestLiveAction) => void;

/**
 * The workout in progress on the lock screen (Workouts R2, section 13):
 * mirrors `ActiveSessionStore` to the Live Activity (iOS) or the ongoing
 * notification (Android), and brings back what their buttons did.
 *
 * The buttons act at once on the phone, with the app asleep: they change the
 * countdown and move or withdraw the rest-over alert. The notes they leave
 * are taken here as soon as the app runs again. The open logger applies them
 * as if its own bar had been tapped (`attach`); with the logger closed, the
 * rest kept in the store is moved on or ended here, and an ended rest is
 * saved as an exact one.
 *
 * Off when the person turned "On the lock screen" off, and on the web.
 */
@Service()
export class LockScreenService {
  private readonly _store = inject(ActiveSessionStore);
  private readonly _settingsStore = inject(WorkoutSettingsStore);
  private readonly _translateService = inject(TranslateService);
  private readonly _workoutLogService = inject(WorkoutLogService);

  /** What was last sent; `undefined` until something was. */
  private _sent: string | null | undefined = undefined;
  private _handler: LockScreenHandler | null = null;
  /** Redraws it when the rest's end passes, while the app is open. */
  private _flip: ReturnType<typeof setTimeout> | null = null;
  /** Bumped when the words arrive, so the lock screen never shows a key. */
  private readonly _words = signal(0);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;
    this._settingsStore.load();

    effect(() => {
      this._words();
      const state = this._state();
      // Nothing is known to be open until the store has asked the API.
      if (!this._store.checked()) return;
      untracked(() => this._mirror(state));
    });

    const words = this._translateService.onLangChange.subscribe(() => this._words.update((n) => n + 1));
    const listeners = [
      RestLive.addListener('action', () => void this.drain()),
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void this.drain();
        // Leaving the app: what it shows from here on is drawn from now.
        else this._resend();
      }),
    ];
    inject(DestroyRef).onDestroy(() => {
      if (this._flip) clearTimeout(this._flip);
      words.unsubscribe();
      for (const listener of listeners) void listener.then((handle) => handle.remove());
    });
    // Anything tapped while the app was closed.
    void this.drain();
  }

  /**
   * The open logger takes the buttons over until it goes. Anything waiting
   * is applied to it at once.
   */
  attach(handler: LockScreenHandler): () => void {
    this._handler = handler;
    void this.drain();
    return () => {
      if (this._handler === handler) this._handler = null;
    };
  }

  /** Takes the notes the buttons left and applies them, oldest first. */
  async drain(): Promise<void> {
    let actions: RestLiveAction[];
    try {
      actions = (await RestLive.takeActions()).actions ?? [];
    } catch {
      return;
    }
    if (actions.length === 0) return;
    for (const action of actions) this._apply(action);
    // Whatever the app now holds goes back, even if it looks unchanged:
    // until now the phone was showing its own version. After the logger's
    // effects have carried its change into the store.
    setTimeout(() => this._resend());
  }

  /** Sends what the app holds now, even if it was sent before. */
  private _resend(): void {
    this._sent = undefined;
    this._mirror(untracked(() => this._state()));
  }

  private _state(): RestLiveState | null {
    const session = this._store.session();
    if (!session || !this._settingsStore.settings().lockScreen) return null;
    return liveState(
      session,
      this._store.rest(),
      this._store.next(),
      (key, params) => this._translateService.instant(key, params),
      Date.now(),
    );
  }

  private _mirror(state: RestLiveState | null): void {
    const key = state ? JSON.stringify(state) : null;
    if (key === this._sent) return;
    this._sent = key;
    const call = state ? RestLive.show(state) : RestLive.end();
    // Not shown is never an error the workout hears about; the next change tries again.
    call.catch(() => (this._sent = undefined));

    // The phone draws the countdown on its own but does not reliably turn
    // it to Go at zero: the app does, if it is open then. Asleep, it is
    // redrawn as the person leaves the app or comes back.
    if (this._flip) clearTimeout(this._flip);
    this._flip = null;
    const endsAt = state?.restEndsAt ?? null;
    if (endsAt !== null && endsAt > Date.now()) {
      this._flip = setTimeout(() => this._resend(), endsAt - Date.now() + 250);
    }
  }

  private _apply(action: RestLiveAction): void {
    if (this._handler) {
      this._handler(action);
      return;
    }
    const rest = this._store.rest();
    if (!rest || rest.logId !== this._store.session()?.id) return;
    if (action.type === RestLiveActionTypes.Extend) {
      if (action.endsAt && rest.endsAt !== null) this._store.setRest({ ...rest, endsAt: action.endsAt });
      return;
    }
    // Skip or Start set: the rest ended then, and that is exactly how long it was.
    this._store.setRest(null);
    const measured = tappedRest((action.at - rest.startedAt) / 1000);
    this._workoutLogService
      .logSet(rest.logId, rest.setId, { restAfterSeconds: measured.seconds, restSource: measured.source })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }
}
