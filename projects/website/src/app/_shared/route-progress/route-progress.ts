import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

import { PageLoadService } from '../page-load.service';

/** Navigations faster than this never show the bar, so cached pages don't flash it. */
const SHOW_DELAY_MS = 150;
/** Matches the fade-out in route-progress.scss. */
const FADE_OUT_MS = 400;

type ProgressState = 'idle' | 'loading' | 'done';

/**
 * Thin bar along the top of the viewport while the router fetches the next
 * page, or while a full page load we started is on its way (PageLoadService,
 * e.g. switching language). Without it a tap on a slow connection looked like
 * nothing happened.
 */
@Component({
  selector: 'mh-route-progress',
  templateUrl: './route-progress.html',
  styleUrl: './route-progress.scss',
})
export class RouteProgress {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _pageLoadService = inject(PageLoadService);

  private readonly _routerState = signal<ProgressState>('idle');
  protected readonly state = computed<ProgressState>(() =>
    this._pageLoadService.isLoading() ? 'loading' : this._routerState()
  );

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
        showTimer = setTimeout(() => this._routerState.set('loading'), SHOW_DELAY_MS);
        return;
      }
      const finished =
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError;
      if (!finished) return;

      clearTimeout(showTimer);
      if (this._routerState() !== 'loading') return;
      this._routerState.set('done');
      hideTimer = setTimeout(() => this._routerState.set('idle'), FADE_OUT_MS);
    });

    this._destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    });
  }
}
