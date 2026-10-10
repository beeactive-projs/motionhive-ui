import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

/** Shape of the Network Information API, which not every browser exposes. */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** Longest wait for an idle moment before preloading anyway. */
const IDLE_TIMEOUT_MS = 3000;

/**
 * Downloads the lazy pages in the background once the first page has loaded,
 * so a tap on a nav link opens the next page without waiting on the network.
 *
 * Waits for the browser to be idle first, so preloading never competes with
 * the visitor's first taps. Holds back when the visitor asked to save data
 * (Save-Data, or a 2G connection), for routes marked `data: { preload: false }`
 * (rarely visited pages that are not worth the bytes), and during prerender.
 */
@Service()
export class NetworkAwarePreloadingStrategy implements PreloadingStrategy {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this._isBrowser || route.data?.['preload'] === false || this._isSavingData()) {
      return of(null);
    }
    return whenIdle().pipe(switchMap(() => load()));
  }

  private _isSavingData(): boolean {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    return !!connection?.saveData || /2g$/.test(connection?.effectiveType ?? '');
  }
}

/** Emits once the browser is idle (Safari has no requestIdleCallback: short timer). */
function whenIdle(): Observable<void> {
  return new Observable<void>((subscriber) => {
    const done = (): void => {
      subscriber.next();
      subscriber.complete();
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(done, { timeout: IDLE_TIMEOUT_MS });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(done, 1000);
    return () => clearTimeout(id);
  });
}
