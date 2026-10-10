import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/** Shape of the Network Information API, which not every browser exposes. */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Downloads the lazy pages in the background once the first page has loaded,
 * so a tap on a nav link opens the next page without waiting on the network.
 *
 * Holds back when the visitor asked to save data (Save-Data, or a 2G
 * connection), for routes marked `data: { preload: false }` (rarely visited
 * pages that are not worth the bytes), and during prerender.
 */
@Service()
export class NetworkAwarePreloadingStrategy implements PreloadingStrategy {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this._isBrowser || route.data?.['preload'] === false || this._isSavingData()) {
      return of(null);
    }
    return load();
  }

  private _isSavingData(): boolean {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    return !!connection?.saveData || /2g$/.test(connection?.effectiveType ?? '');
  }
}
