import { DOCUMENT, DestroyRef, Service, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * A clock that never ticks.
 *
 * Screens that render "in 18 min" need a `now` that participates in the signal
 * graph, but a `setInterval` behind it means every open page re-renders once a
 * second for the life of the app — Ionic keeps pages alive in the tab stack, so
 * "the life of the app" is literal. That timer was deliberately removed once
 * already; this is the replacement, not a reintroduction.
 *
 * Instead `now` is pulled forward at the moments a stale value could actually
 * be seen fresh: entering a page, pulling to refresh, and coming back from the
 * background. Between those the value is frozen, which is safe because the only
 * consumer — `formatTimeUntil` — resolves to minutes solely inside the last
 * hour and returns null past eight. A reader who has been staring at the screen
 * long enough to drift is a reader who is about to pull to refresh.
 *
 * Callers inject this and expose a `computed()` over `now()`; pages call
 * `bump()` from `ionViewWillEnter` and after a refresh.
 */
@Service()
export class ClockService {
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _now = signal(Date.now());

  /** Milliseconds since the epoch, as of the last `bump()`. */
  readonly now = this._now.asReadonly();

  constructor() {
    // Backgrounding the app is the one way to drift by hours without touching
    // the screen. Both listeners are needed: `visibilitychange` covers the
    // browser dev server and a WebView being obscured, the Capacitor event
    // covers a real app resume, and neither fires reliably for the other case.
    const onVisible = () => {
      if (this._document.visibilityState === 'visible') this.bump();
    };
    this._document.addEventListener('visibilitychange', onVisible);

    const listener = CapacitorApp.addListener('resume', () => this.bump());

    this._destroyRef.onDestroy(() => {
      this._document.removeEventListener('visibilitychange', onVisible);
      void listener.then((handle) => handle.remove());
    });
  }

  /** Pull `now` forward. Cheap and idempotent — call it liberally. */
  bump(): void {
    this._now.set(Date.now());
  }
}
