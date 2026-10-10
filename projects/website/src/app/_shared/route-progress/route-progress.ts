import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/** Navigations faster than this never show the bar, so cached pages don't flash it. */
const SHOW_DELAY_MS = 150;
/** Matches the fade-out in route-progress.scss. */
const FADE_OUT_MS = 400;

type ProgressState = 'idle' | 'loading' | 'done';

/**
 * Thin bar along the top of the viewport while the router fetches the next
 * page. Without it a tap on a slow connection looked like nothing happened.
 */
@Component({
  selector: 'mh-route-progress',
  templateUrl: './route-progress.html',
  styleUrl: './route-progress.scss',
})
export class RouteProgress {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly state = signal<ProgressState>('idle');

  constructor() {
    // Browser only: a pending timer during prerender would hold the page open.
    afterNextRender(() => this._trackNavigations());
  }

  private _trackNavigations(): void {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const subscription = this._router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(hideTimer);
        showTimer = setTimeout(() => this.state.set('loading'), SHOW_DELAY_MS);
        return;
      }
      const finished =
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError;
      if (!finished) return;

      clearTimeout(showTimer);
      if (this.state() !== 'loading') return;
      this.state.set('done');
      hideTimer = setTimeout(() => this.state.set('idle'), FADE_OUT_MS);
    });

    this._destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    });
  }
}
